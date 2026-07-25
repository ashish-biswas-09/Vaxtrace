"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type PopulationState = { error?: string; ok?: string } | undefined;

const schema = z.object({
  location_id: z.string().uuid("এলাকা নির্বাচন করুন"),
  year: z.coerce.number().int().min(2000).max(2100),
  age_band: z.enum(["live_births", "surviving_infants", "0_11m", "12_23m", "0_59m"]),
  estimate: z.coerce.number().int().min(0, "সংখ্যা ঋণাত্মক হতে পারে না"),
  // Mandatory, and not a formality: a denominator whose provenance is unknown cannot be used
  // in a report anyone has to sign. Every published coverage figure divides by this number.
  source: z.string().trim().min(3, "উৎস লিখুন — যেমন 'BBS আদমশুমারি ২০২২'").max(160),
});

export async function upsertPopulationAction(
  _prev: PopulationState,
  formData: FormData,
): Promise<PopulationState> {
  const parsed = schema.safeParse({
    location_id: formData.get("location_id"),
    year: formData.get("year"),
    age_band: formData.get("age_band"),
    estimate: formData.get("estimate"),
    source: formData.get("source"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const { supabase, claims } = await requireAppRole("programme_manager");
  void claims;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Upsert on the natural key (location, year, age band): re-entering a figure is a
  // correction, not a second denominator. The audit trigger records the before and after, so
  // "this number changed and the coverage report moved" stays answerable.
  const { error } = await supabase.from("population_estimates").upsert(
    {
      location_id: parsed.data.location_id,
      year: parsed.data.year,
      age_band: parsed.data.age_band,
      estimate: parsed.data.estimate,
      source: parsed.data.source,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "location_id,year,age_band" },
  );

  if (error) {
    if (error.message.includes("row-level security") || error.message.includes("violates")) {
      return {
        error:
          "অনুমতি নেই — এলাকাটি আপনার দায়িত্বের ভেতরে আছে কি না, এবং দুই-ধাপ যাচাই চালু আছে কি না দেখুন।",
      };
    }
    return { error: "জনসংখ্যার হিসাব সংরক্ষণ করা যায়নি।" };
  }

  revalidatePath("/admin/population");
  return { ok: "জনসংখ্যার হিসাব সংরক্ষিত হয়েছে।" };
}
