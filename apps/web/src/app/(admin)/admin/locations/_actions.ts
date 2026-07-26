"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type GeoState = { error?: string; ok?: string } | undefined;

const LEVELS = [
  "country",
  "division",
  "district",
  "upazila",
  "city_corporation",
  "union",
  "urban_ward",
  "ward",
  "village",
  "mahalla",
] as const;

const locationSchema = z.object({
  parent_id: z.string().uuid("মূল এলাকা নির্বাচন করুন"),
  level: z.enum(LEVELS),
  // The slug becomes a label in every descendant's ltree path, so it is ASCII and immutable.
  // Rejecting a bad one here produces a readable message; the CHECK constraint behind it is
  // what guarantees nothing else can write one.
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]+$/, "ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও আন্ডারস্কোর ব্যবহার করুন"),
  name_bn: z.string().trim().min(1, "বাংলা নাম লিখুন").max(120),
  name_en: z.string().trim().min(1, "ইংরেজি নাম লিখুন").max(120),
  geo_code: z.string().trim().max(30).optional().or(z.literal("")),
  is_urban: z.coerce.boolean().optional(),
});

// Adding a node to the administrative hierarchy. Restricted to system_admin because a
// location edit silently re-scopes everyone assigned at or below it — it is a change to the
// authorization graph, not to reference data.
export async function createLocationAction(
  _prev: GeoState,
  formData: FormData,
): Promise<GeoState> {
  const parsed = locationSchema.safeParse({
    parent_id: formData.get("parent_id"),
    level: formData.get("level"),
    slug: formData.get("slug"),
    name_bn: formData.get("name_bn"),
    name_en: formData.get("name_en"),
    geo_code: formData.get("geo_code") ?? "",
    is_urban: formData.get("is_urban") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const { supabase } = await requireAppRole("system_admin");

  // `path` is omitted deliberately: trg_location_path derives it from the parent, and a
  // supplied value would be overwritten anyway.
  const { error } = await supabase.from("locations").insert({
    parent_id: parsed.data.parent_id,
    level: parsed.data.level,
    slug: parsed.data.slug,
    name_bn: parsed.data.name_bn,
    name_en: parsed.data.name_en,
    geo_code: parsed.data.geo_code || null,
    is_urban: parsed.data.is_urban ?? false,
  });

  if (error) {
    if (error.message.includes("locations_parent_id_slug_key")) {
      return { error: "এই মূল এলাকার অধীনে একই স্লাগ ইতিমধ্যে আছে।" };
    }
    if (error.message.includes("geo_code")) {
      return { error: "এই জিও-কোড অন্য একটি এলাকায় ব্যবহৃত হয়েছে।" };
    }
    return { error: "এলাকা যোগ করা যায়নি।" };
  }

  revalidatePath("/admin/locations");
  return { ok: `${parsed.data.name_bn} যোগ হয়েছে।` };
}

const closeSchema = z.object({
  id: z.string().uuid(),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ সঠিক নয়"),
});

// Boundaries change: upazilas split, unions are redrawn. A location is never edited in place
// or deleted — it is closed, and a successor is opened under the new parent. That is what
// keeps a two-year-old coverage report reproducible instead of silently re-attributed.
export async function closeLocationAction(
  _prev: GeoState,
  formData: FormData,
): Promise<GeoState> {
  const parsed = closeSchema.safeParse({
    id: formData.get("id"),
    valid_to: formData.get("valid_to"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("system_admin");

  const { error } = await supabase
    .from("locations")
    .update({ valid_to: parsed.data.valid_to })
    .eq("id", parsed.data.id);

  if (error) return { error: "এলাকা বন্ধ করা যায়নি।" };

  revalidatePath("/admin/locations");
  return { ok: "এলাকাটি বন্ধ করা হয়েছে।" };
}
