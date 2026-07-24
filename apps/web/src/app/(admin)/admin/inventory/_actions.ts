"use server";

import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const editSchema = z.object({
  id: z.string().uuid(),
  batch_number: z.string().trim().min(1, "ব্যাচ নম্বর দিন").max(64),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "মেয়াদের তারিখ সঠিক নয়"),
  stock_quantity: z.coerce.number().int().min(0, "মজুদ ঋণাত্মক হতে পারে না"),
});

export async function editBatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = editSchema.safeParse({
    id: formData.get("id"),
    batch_number: formData.get("batch_number"),
    expiry_date: formData.get("expiry_date"),
    stock_quantity: formData.get("stock_quantity"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { id, ...fields } = parsed.data;
  const supabase = await requireRole("admin");
  const { error } = await supabase
    .from("inventories")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "সংরক্ষণ ব্যর্থ হয়েছে — আবার চেষ্টা করুন।" };

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/inventory/${id}`);
  return { ok: true };
}

const adjustSchema = z.object({
  id: z.string().uuid(),
  delta: z.coerce.number().int().refine((n) => n !== 0, "পরিমাণ শূন্য হতে পারে না"),
});

// Signed stock adjustment (restock +, consume −). Clamped at 0 so a bad delta can't drive
// stock negative (the DB check constraint would reject it anyway, but fail with a clear message).
export async function adjustStockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = adjustSchema.safeParse({ id: formData.get("id"), delta: formData.get("delta") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const supabase = await requireRole("admin");
  const { data: row, error: readErr } = await supabase
    .from("inventories")
    .select("stock_quantity")
    .eq("id", parsed.data.id)
    .single();
  if (readErr || !row) return { error: "ব্যাচ খুঁজে পাওয়া যায়নি।" };

  const next = row.stock_quantity + parsed.data.delta;
  if (next < 0) return { error: "মজুদের চেয়ে বেশি কমানো যাবে না।" };

  const { error } = await supabase
    .from("inventories")
    .update({ stock_quantity: next, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: "হালনাগাদ ব্যর্থ হয়েছে।" };

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/inventory/${parsed.data.id}`);
  return { ok: true };
}
