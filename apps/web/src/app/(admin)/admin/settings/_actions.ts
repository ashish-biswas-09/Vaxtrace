"use server";

import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type SettingsState = { error?: string; ok?: string } | undefined;

// Bounds are the point of this schema. A lead time of 400 days would queue a reminder for
// every dose a child will ever receive; a run hour of 25 would silently never fire.
const schema = z.object({
  reminder_lead_days: z.coerce.number().int().min(0).max(30),
  daily_run_hour: z.coerce.number().int().min(0).max(23),
  quiet_hours_start: z.coerce.number().int().min(0).max(23),
  quiet_hours_end: z.coerce.number().int().min(0).max(23),
  channel_sms: z.coerce.boolean(),
  channel_email: z.coerce.boolean(),
});

export async function updateSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = schema.safeParse({
    reminder_lead_days: formData.get("reminder_lead_days"),
    daily_run_hour: formData.get("daily_run_hour"),
    quiet_hours_start: formData.get("quiet_hours_start"),
    quiet_hours_end: formData.get("quiet_hours_end"),
    // Unchecked checkboxes are absent from FormData entirely, so absence means false.
    channel_sms: formData.get("channel_sms") === "on",
    channel_email: formData.get("channel_email") === "on",
  });
  if (!parsed.success) {
    return { error: "মান সীমার বাইরে — লিড টাইম ০–৩০ দিন, ঘণ্টা ০–২৩।" };
  }

  const supabase = await requireRole("admin");

  // upsert rather than update: a key added by a later migration but never edited would
  // otherwise be missing and silently skipped.
  const { error } = await supabase.from("app_settings").upsert(
    Object.entries(parsed.data).map(([key, value]) => ({ key, value })),
    { onConflict: "key" },
  );
  if (error) return { error: "সংরক্ষণ ব্যর্থ হয়েছে।" };

  revalidatePath("/admin/settings");
  revalidatePath("/admin/notifications");
  return { ok: "সেটিংস সংরক্ষিত হয়েছে।" };
}
