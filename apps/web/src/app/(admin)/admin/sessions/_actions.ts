"use server";

import { requireAppRole } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import {
  SESSION_SITE_LEVELS,
  catchmentRoot,
  isUnder,
  type LocationNode,
} from "@/lib/locations";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type SessionState = { error?: string; ok?: string } | undefined;

const planSchema = z
  .object({
    facility_id: z.string().uuid("পরিচালনাকারী কেন্দ্র বেছে নিন"),
    location_id: z.string().uuid("সেশনের স্থান বেছে নিন"),
    type: z.enum(["fixed", "outreach", "campaign"]),
    session_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ দিন")
      // The form's `min` is a hint; this is the rule. A plan for a date already gone is not a
      // plan, and it lands straight in "রিপোর্ট হয়নি".
      .refine((d) => d >= todayIso(), "আজ বা পরের কোনো তারিখ দিন"),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    team_lead: z.string().uuid().optional().or(z.literal("")),
    target_children: z.coerce.number().int().min(0).max(10000).optional(),
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
  const v = parsed.data;

  const { supabase } = await requireAppRole("supervisor");

  // Where the session is held has to make sense for who runs it (K-17): a fixed session is at
  // the facility itself; outreach and campaigns go to a union/ward inside the facility's
  // upazila. Checked here as well as in the form, because a form is only a suggestion.
  const [{ data: facility }, { data: locations }] = await Promise.all([
    supabase.from("facilities").select("id, location_id").eq("id", v.facility_id).maybeSingle(),
    supabase.from("locations").select("id, name_bn, name_en, level, path, parent_id").is("valid_to", null),
  ]);
  if (!facility) return { error: "কেন্দ্রটি পাওয়া যায়নি বা আপনার এলাকার বাইরে।" };
  const nodes = (locations ?? []) as LocationNode[];
  const byPath = new Map(nodes.map((l) => [l.path, l]));
  const byId = new Map(nodes.map((l) => [l.id, l]));
  const home = byId.get(facility.location_id);
  const site = byId.get(v.location_id);
  if (!home || !site) return { error: "সেশনের স্থানটি পাওয়া যায়নি বা আপনার এলাকার বাইরে।" };

  if (v.type === "fixed" && site.id !== home.id) {
    return { error: "স্থায়ী কেন্দ্রের সেশন কেন্দ্রের নিজের এলাকাতেই হয়।" };
  }
  if (
    v.type !== "fixed" &&
    (!SESSION_SITE_LEVELS.includes(site.level) || !isUnder(site.path, catchmentRoot(home.path, byPath)))
  ) {
    return { error: "আউটরিচ বা ক্যাম্পেইনের স্থান হবে কেন্দ্রের উপজেলার ভেতরের কোনো ইউনিয়ন বা ওয়ার্ড।" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("sessions").insert({
    facility_id: v.facility_id,
    location_id: v.location_id,
    type: v.type,
    session_date: v.session_date,
    start_time: v.start_time ?? null,
    end_time: v.end_time ?? null,
    team_lead: v.team_lead || null,
    target_children: v.target_children ?? null,
    notes: v.notes ?? null,
    created_by: user?.id ?? null,
  });

  if (error) {
    console.error("planSessionAction", error);
    return {
      error: error.message.includes("row-level security")
        ? "এই এলাকায় সেশন পরিকল্পনার অনুমতি আপনার নেই।"
        : "সেশন সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।",
    };
  }

  revalidatePath("/admin/sessions");
  return { ok: "সেশন পরিকল্পনা সংরক্ষিত হয়েছে।" };
}

const cancelSchema = z.object({
  session_id: z.string().uuid(),
  // The reason is required by a table constraint, not only by this form.
  cancel_reason: z.string().trim().min(3, "বাতিলের কারণ লিখুন (অন্তত ৩ অক্ষর)").max(300),
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

  // `.select()` so the row count comes back. An UPDATE that RLS filters out, or that finds the
  // session already held or cancelled, affects nothing and raises nothing — without this the
  // screen said "বাতিল হয়েছে" for a session that was not (K-06).
  const { data, error } = await supabase
    .from("sessions")
    .update({ status: "cancelled", cancel_reason: parsed.data.cancel_reason })
    .eq("id", parsed.data.session_id)
    .eq("status", "planned")
    .select("id");

  if (error) {
    console.error("cancelSessionAction", error);
    return { error: "সেশন বাতিল করা যায়নি। আবার চেষ্টা করুন।" };
  }
  if (!data || data.length === 0) {
    return {
      error: "সেশনটি বাতিল করা যায়নি — এটি আর পরিকল্পিত অবস্থায় নেই, অথবা আপনার এলাকার বাইরে।",
    };
  }

  revalidatePath("/admin/sessions");
  return { ok: "সেশন বাতিল হয়েছে।" };
}

// Staff who can lead a session at this facility, by name, within the caller's scope. Returns
// null when the lookup is unavailable (the session_staff migration not yet applied) so the
// form can fall back to the list it was rendered with.
export async function sessionStaffAction(
  facilityId: string,
): Promise<{ id: string; name: string }[] | null> {
  if (!z.string().uuid().safeParse(facilityId).success) return [];
  const { supabase } = await requireAppRole("supervisor");
  const { data, error } = await supabase.rpc("session_staff", { p_facility: facilityId });
  if (error) return null;
  return (data ?? []).map((s) => ({ id: s.id, name: s.full_name ?? "—" }));
}
