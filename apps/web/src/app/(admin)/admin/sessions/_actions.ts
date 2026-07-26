"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type SessionState = { error?: string; ok?: string } | undefined;

const planSchema = z
  .object({
    facility_id: z.string().uuid("সেবা কেন্দ্র নির্বাচন করুন"),
    location_id: z.string().uuid("এলাকা নির্বাচন করুন"),
    type: z.enum(["fixed", "outreach", "campaign"]),
    session_date: z.string().min(1, "তারিখ দিন"),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    team_lead: z.string().uuid().optional().or(z.literal("")),
    target_children: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().max(400).optional(),
  })
  .refine((v) => !v.start_time || !v.end_time || v.end_time > v.start_time, {
    message: "শেষের সময় শুরুর সময়ের পরে হতে হবে",
    path: ["end_time"],
  });

export async function planSessionAction(
  _prev: SessionState,
  formData: FormData,
): Promise<SessionState> {
  const parsed = planSchema.safeParse({
    facility_id: formData.get("facility_id"),
    location_id: formData.get("location_id"),
    type: formData.get("type"),
    session_date: formData.get("session_date"),
    start_time: formData.get("start_time") || undefined,
    end_time: formData.get("end_time") || undefined,
    team_lead: formData.get("team_lead") || "",
    target_children: formData.get("target_children") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("supervisor");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("sessions").insert({
    facility_id: parsed.data.facility_id,
    location_id: parsed.data.location_id,
    type: parsed.data.type,
    session_date: parsed.data.session_date,
    start_time: parsed.data.start_time ?? null,
    end_time: parsed.data.end_time ?? null,
    team_lead: parsed.data.team_lead || null,
    target_children: parsed.data.target_children ?? null,
    notes: parsed.data.notes ?? null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "এই এলাকায় সেশন পরিকল্পনার অনুমতি নেই।"
        : "সেশন সংরক্ষণ করা যায়নি।",
    };
  }

  revalidatePath("/admin/sessions");
  return { ok: "সেশন পরিকল্পিত হয়েছে।" };
}

const cancelSchema = z.object({
  session_id: z.string().uuid(),
  // The reason is required by a table constraint, not only by this form. A cancellation rate
  // broken down by reason is the number that gets outreach transport funded; an empty reason
  // makes the whole breakdown useless.
  cancel_reason: z.string().trim().min(3, "বাতিলের কারণ লিখুন").max(300),
});

export async function cancelSessionAction(
  _prev: SessionState,
  formData: FormData,
): Promise<SessionState> {
  const parsed = cancelSchema.safeParse({
    session_id: formData.get("session_id"),
    cancel_reason: formData.get("cancel_reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "কারণ লিখুন" };

  const { supabase } = await requireAppRole("supervisor");

  const { error } = await supabase
    .from("sessions")
    .update({ status: "cancelled", cancel_reason: parsed.data.cancel_reason })
    .eq("id", parsed.data.session_id)
    .eq("status", "planned");

  if (error) return { error: "সেশন বাতিল করা যায়নি।" };

  revalidatePath("/admin/sessions");
  return { ok: "সেশন বাতিল হয়েছে।" };
}
