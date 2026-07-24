"use server";

import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type CatalogState = { error?: string; ok?: boolean } | undefined;

const vaccineSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  code: z
    .string()
    .trim()
    .min(1, "কোড দিন")
    .max(20)
    .transform((s) => s.toUpperCase()),
  name_bn: z.string().trim().min(1, "বাংলা নাম দিন").max(120),
  name_en: z.string().trim().min(1, "ইংরেজি নাম দিন").max(120),
  total_doses: z.coerce.number().int().min(1, "কমপক্ষে ১ ডোজ").max(10),
  is_active: z.coerce.boolean(),
});

// Create (no id) or update (id) a vaccine. On create, redirect to its detail page so the
// admin can set the per-dose schedule next. Audited by the vaccines trigger.
export async function upsertVaccineAction(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const parsed = vaccineSchema.safeParse({
    id: formData.get("id") ?? undefined,
    code: formData.get("code"),
    name_bn: formData.get("name_bn"),
    name_en: formData.get("name_en"),
    total_doses: formData.get("total_doses"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { id, ...fields } = parsed.data;
  const supabase = await requireRole("admin");

  let newId = id;
  if (id) {
    const { error } = await supabase.from("vaccines").update(fields).eq("id", id);
    if (error) return { error: "সংরক্ষণ ব্যর্থ — কোডটি হয়তো ইতিমধ্যে ব্যবহৃত।" };
  } else {
    const { data, error } = await supabase.from("vaccines").insert(fields).select("id").single();
    if (error || !data) return { error: "তৈরি ব্যর্থ — কোডটি হয়তো ইতিমধ্যে ব্যবহৃত।" };
    newId = data.id;
  }

  revalidatePath("/admin/catalog");
  if (!id && newId) redirect(`/admin/catalog/${newId}`);
  return { ok: true };
}

const dosesSchema = z.object({
  vaccine_id: z.string().uuid(),
  ages: z.array(z.coerce.number().int().min(0)),
  intervals: z.array(z.coerce.number().int().min(0)),
});

// Replaces the whole dose schedule for a vaccine (delete-all + insert set). dose_number is
// the row's position (1-based). Audited per row by the vaccine_doses trigger.
export async function upsertVaccineDosesAction(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const parsed = dosesSchema.safeParse({
    vaccine_id: formData.get("vaccine_id"),
    ages: formData.getAll("recommended_age_days"),
    intervals: formData.getAll("min_interval_days"),
  });
  if (!parsed.success) return { error: "ডোজের তথ্য সঠিক নয়" };
  if (parsed.data.ages.length === 0) return { error: "কমপক্ষে একটি ডোজ দিন" };

  const rows = parsed.data.ages.map((age, i) => ({
    vaccine_id: parsed.data.vaccine_id,
    dose_number: i + 1,
    recommended_age_days: age,
    min_interval_days: parsed.data.intervals[i] ?? 0,
  }));

  const supabase = await requireRole("admin");
  const { error: delErr } = await supabase
    .from("vaccine_doses")
    .delete()
    .eq("vaccine_id", parsed.data.vaccine_id);
  if (delErr) return { error: "পুরনো সূচি মুছতে ব্যর্থ হয়েছে।" };

  const { error } = await supabase.from("vaccine_doses").insert(rows);
  if (error) return { error: "ডোজ সূচি সংরক্ষণ ব্যর্থ হয়েছে।" };

  revalidatePath(`/admin/catalog/${parsed.data.vaccine_id}`);
  return { ok: true };
}
