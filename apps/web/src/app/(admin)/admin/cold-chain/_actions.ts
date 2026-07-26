"use server";

import { requireAppRole } from "@/lib/auth";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ColdChainState = { error?: string; ok?: string } | undefined;

const deviceSchema = z
  .object({
    facility_id: z.string().uuid("কেন্দ্র নির্বাচন করুন"),
    name: z.string().trim().min(1, "যন্ত্রের নাম দিন").max(80),
    kind: z.enum(["ilr", "deep_freezer", "vaccine_carrier", "cold_box", "walk_in_cooler"]),
    min_c: z.coerce.number(),
    max_c: z.coerce.number(),
  })
  .refine((v) => v.max_c > v.min_c, {
    message: "সর্বোচ্চ তাপমাত্রা সর্বনিম্নের চেয়ে বেশি হতে হবে",
    path: ["max_c"],
  });

export async function addDeviceAction(
  _prev: ColdChainState,
  formData: FormData,
): Promise<ColdChainState> {
  const parsed = deviceSchema.safeParse({
    facility_id: formData.get("facility_id"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    min_c: formData.get("min_c"),
    max_c: formData.get("max_c"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("store_keeper");

  const { error } = await supabase.from("cold_chain_devices").insert(parsed.data);
  if (error) {
    if (error.message.includes("duplicate key")) {
      return { error: "এই কেন্দ্রে এই নামে একটি যন্ত্র ইতিমধ্যে আছে।" };
    }
    return { error: "যন্ত্র যোগ করা যায়নি।" };
  }

  revalidatePath("/admin/cold-chain");
  return { ok: "যন্ত্র যোগ হয়েছে।" };
}

const readingSchema = z.object({
  device_id: z.string().uuid("যন্ত্র নির্বাচন করুন"),
  temperature_c: z.coerce
    .number()
    .min(-80, "তাপমাত্রা সম্ভাব্য সীমার বাইরে")
    .max(60, "তাপমাত্রা সম্ভাব্য সীমার বাইরে"),
  action_taken: z.string().trim().max(300).optional(),
});

// Recording a reading is a twice-daily chore done by whoever is standing at the fridge, so it
// is open to any worker rather than to store keepers only — a log that requires a privileged
// account is a log that stops being kept. Readings are append-only in the database, which is
// why there is no edit action here to write.
export async function addReadingAction(
  _prev: ColdChainState,
  formData: FormData,
): Promise<ColdChainState> {
  const parsed = readingSchema.safeParse({
    device_id: formData.get("device_id"),
    temperature_c: formData.get("temperature_c"),
    action_taken: formData.get("action_taken") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("cold_chain_readings").insert({
    device_id: parsed.data.device_id,
    temperature_c: parsed.data.temperature_c,
    action_taken: parsed.data.action_taken ?? null,
    recorded_by: user.id,
  });

  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "এই যন্ত্রে তাপমাত্রা লেখার অনুমতি নেই।"
        : "তাপমাত্রা সংরক্ষণ করা যায়নি।",
    };
  }

  revalidatePath("/admin/cold-chain");
  return { ok: "তাপমাত্রা নথিভুক্ত হয়েছে।" };
}
