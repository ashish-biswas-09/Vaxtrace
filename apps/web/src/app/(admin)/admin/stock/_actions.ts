"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type StockState = { error?: string; ok?: string } | undefined;

const schema = z
  .object({
    inventory_id: z.string().uuid("ব্যাচ নির্বাচন করুন"),
    txn_type: z.enum(["receipt", "wastage", "adjustment"]),
    // Always entered as a positive number of doses. The sign is a property of the transaction
    // type, not something a store keeper should have to reason about at a counter — and the
    // table's own check constraint is what finally enforces it.
    quantity: z.coerce.number().int().positive("সংখ্যা শূন্যের বেশি হতে হবে"),
    direction: z.enum(["in", "out"]).optional(),
    reason: z
      .enum(["open_vial", "vvm", "breakage", "expiry", "frozen", "other"])
      .optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.txn_type !== "wastage" || v.reason, {
    message: "অপচয়ের কারণ নির্বাচন করুন",
    path: ["reason"],
  })
  .refine((v) => v.txn_type !== "adjustment" || (v.note && v.note.length >= 3), {
    message: "সমন্বয়ের ব্যাখ্যা লিখুন — অডিটে প্রথম যে ঘরটি পড়া হয়",
    path: ["note"],
  });

export async function recordMovementAction(
  _prev: StockState,
  formData: FormData,
): Promise<StockState> {
  const parsed = schema.safeParse({
    inventory_id: formData.get("inventory_id"),
    txn_type: formData.get("txn_type"),
    quantity: formData.get("quantity"),
    direction: formData.get("direction") || undefined,
    reason: formData.get("reason") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("store_keeper");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "সেশন পাওয়া যায়নি।" };

  const { txn_type, quantity, direction } = parsed.data;
  const signed =
    txn_type === "receipt"
      ? quantity
      : txn_type === "wastage"
        ? -quantity
        : direction === "out"
          ? -quantity
          : quantity;

  const { error } = await supabase.from("stock_transactions").insert({
    inventory_id: parsed.data.inventory_id,
    txn_type,
    quantity: signed,
    reason: txn_type === "wastage" ? (parsed.data.reason ?? null) : null,
    note: parsed.data.note ?? null,
    performed_by: user.id,
  });

  if (error) {
    // trg_stock_apply turns an over-issue into a sentence with the real numbers in it; passing
    // that through is more useful than a generic failure, and it is not sensitive.
    if (error.message.includes("Not enough stock")) {
      return { error: "এই ব্যাচে যথেষ্ট মজুদ নেই — লেজারে হিসাব মেলেনি।" };
    }
    if (error.message.includes("row-level security")) {
      return { error: "এই গুদামে লেনদেন করার অনুমতি নেই।" };
    }
    return { error: "লেনদেন সংরক্ষণ করা যায়নি।" };
  }

  revalidatePath("/admin/stock");
  revalidatePath("/admin/inventory");
  return { ok: "লেনদেন লেজারে যোগ হয়েছে।" };
}
