"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type FacilityState = { error?: string; ok?: string } | undefined;

const FACILITY_TYPES = [
  "upazila_health_complex",
  "union_health_centre",
  "community_clinic",
  "city_corporation_centre",
  "ngo_clinic",
  "outreach_site",
  "hospital",
] as const;

const facilitySchema = z.object({
  name_bn: z.string().trim().min(1, "বাংলা নাম লিখুন").max(160),
  name_en: z.string().trim().min(1, "ইংরেজি নাম লিখুন").max(160),
  type: z.enum(FACILITY_TYPES),
  location_id: z.string().uuid("কেন্দ্রের অবস্থান নির্বাচন করুন"),
  is_store: z.coerce.boolean().optional(),
});

// A facility is *located in* one place and *serves* a set of places, and those two sets are
// different — an outreach site sits in one ward and serves three. Creating it records only
// where it is; the catchment (what it serves) is managed separately below, because conflating
// them is what makes every facility-attributed coverage number wrong.
//
// `code` is omitted: the column default mints FAC-nnnnnn from a sequence, so it is never a
// client's to choose.
export async function createFacilityAction(
  _prev: FacilityState,
  formData: FormData,
): Promise<FacilityState> {
  const parsed = facilitySchema.safeParse({
    name_bn: formData.get("name_bn"),
    name_en: formData.get("name_en"),
    type: formData.get("type"),
    location_id: formData.get("location_id"),
    is_store: formData.get("is_store") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const { supabase } = await requireAppRole("programme_manager");

  const { data, error } = await supabase
    .from("facilities")
    .insert({
      name_bn: parsed.data.name_bn,
      name_en: parsed.data.name_en,
      type: parsed.data.type,
      location_id: parsed.data.location_id,
      is_store: parsed.data.is_store ?? false,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "কেন্দ্র যোগ করা যায়নি।" };

  // A facility with no catchment serves nobody, which is never what the creator meant. The
  // place it sits in is the only defensible default, and it stays editable.
  await supabase
    .from("facility_catchments")
    .insert({ facility_id: data.id, location_id: parsed.data.location_id, is_primary: true });

  revalidatePath("/admin/facilities");
  return { ok: `${parsed.data.name_bn} যোগ হয়েছে।` };
}

const catchmentSchema = z.object({
  facility_id: z.string().uuid(),
  location_id: z.string().uuid("এলাকা নির্বাচন করুন"),
});

export async function addCatchmentAction(
  _prev: FacilityState,
  formData: FormData,
): Promise<FacilityState> {
  const parsed = catchmentSchema.safeParse({
    facility_id: formData.get("facility_id"),
    location_id: formData.get("location_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("programme_manager");

  const { error } = await supabase.from("facility_catchments").insert({
    facility_id: parsed.data.facility_id,
    location_id: parsed.data.location_id,
    is_primary: false,
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { error: "এই এলাকা ইতিমধ্যে যুক্ত আছে।" };
    }
    return { error: "এলাকা যুক্ত করা যায়নি।" };
  }

  revalidatePath("/admin/facilities");
  return { ok: "সেবা এলাকা যুক্ত হয়েছে।" };
}

export async function removeCatchmentAction(
  _prev: FacilityState,
  formData: FormData,
): Promise<FacilityState> {
  const parsed = catchmentSchema.safeParse({
    facility_id: formData.get("facility_id"),
    location_id: formData.get("location_id"),
  });
  if (!parsed.success) return { error: "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("programme_manager");

  const { error } = await supabase
    .from("facility_catchments")
    .delete()
    .eq("facility_id", parsed.data.facility_id)
    .eq("location_id", parsed.data.location_id);

  if (error) return { error: "এলাকা বাদ দেওয়া যায়নি।" };

  revalidatePath("/admin/facilities");
  return { ok: "সেবা এলাকা বাদ দেওয়া হয়েছে।" };
}
