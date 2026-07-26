"use server";

import { getUserRole, requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type DuplicateMatch = {
  id: string;
  child_id: string;
  full_name: string;
  date_of_birth: string;
  guardian_name: string;
  reason: string;
  confidence: string;
};

export type RegisterState =
  | { error?: string; duplicates?: DuplicateMatch[] }
  | undefined;

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const digits = (v: string) =>
  v.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))).replace(/[^0-9+]/g, "");

const schema = z
  .object({
    full_name: z.string().trim().min(1, "শিশুর নাম লিখুন").max(120),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "জন্মতারিখ সঠিক নয়"),
    gender: z.enum(["male", "female", "other"]),
    location_id: z.string().uuid("এলাকা নির্বাচন করুন"),
    // Optional and verifiable-later, never a registration prerequisite: birth-registration
    // coverage is incomplete and many children have no BRN at first contact (report §8.3).
    birth_registration_no: z
      .string()
      .transform(digits)
      .refine((v) => v === "" || /^[0-9]{17}$/.test(v), { message: "জন্ম নিবন্ধন নম্বর ১৭ সংখ্যার" }),

    // Either an existing guardian, or enough to create one. No account required for either —
    // that is the whole point of BS-02.
    guardian_id: z.string().uuid().or(z.literal("")),
    guardian_name: z.string().trim().max(120),
    guardian_phone: z.string().transform(digits),
    guardian_relationship: z.enum([
      "mother",
      "father",
      "grandparent",
      "sibling",
      "other_relative",
      "caregiver",
    ]),
    confirmed_new: z.string().optional(),
  })
  .refine(
    (v) => v.guardian_id !== "" || (v.guardian_name.length > 0 && /^\+?[0-9]{6,20}$/.test(v.guardian_phone)),
    { message: "অভিভাবক নির্বাচন করুন, অথবা নতুন অভিভাবকের নাম ও ফোন নম্বর লিখুন" },
  );

// Registering a child is the moment the whole system starts for that child: the insert fires
// child_id_guard (mints the immutable 10-digit Child ID), children_location (stamps the ltree
// path scope is decided by) and child_after_insert (derives the full schedule from the date of
// birth). None of that is done here — doing it in app code would mean a child registered by
// any other path silently has no ID, no scope and no schedule.
//
// requireUser, not requireRole: workers and admins may both register, and RLS
// (children_insert) is what actually decides — including that the location is inside the
// registrar's own scope.
export async function registerChildAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    date_of_birth: formData.get("date_of_birth"),
    gender: formData.get("gender"),
    location_id: formData.get("location_id"),
    birth_registration_no: formData.get("birth_registration_no") ?? "",
    guardian_id: formData.get("guardian_id") ?? "",
    guardian_name: formData.get("guardian_name") ?? "",
    guardian_phone: formData.get("guardian_phone") ?? "",
    guardian_relationship: formData.get("guardian_relationship") ?? "mother",
    confirmed_new: formData.get("confirmed_new")?.toString(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  // A future date of birth would generate a schedule of doses that are all "upcoming"
  // forever. The DB has the same CHECK; this just fails with a readable message first.
  if (parsed.data.date_of_birth > new Date().toISOString().slice(0, 10)) {
    return { error: "জন্মতারিখ ভবিষ্যতের হতে পারে না।" };
  }

  const { supabase, user } = await requireUser();

  // FR-16 / BS-05. A child registered at a facility in January and again at an outreach
  // session in March by a worker who could not find the first record *will* be duplicated,
  // and the absence of this check is what manufactures them. It is a warning, not a block:
  // twins share a surname, a date of birth and a phone number.
  if (!parsed.data.confirmed_new) {
    let phone = parsed.data.guardian_phone || null;
    if (!phone && parsed.data.guardian_id) {
      const { data: g } = await supabase
        .from("guardians")
        .select("phone")
        .eq("id", parsed.data.guardian_id)
        .maybeSingle();
      phone = g?.phone ?? null;
    }

    const { data: matches } = await supabase.rpc("find_duplicate_children", {
      p_full_name: parsed.data.full_name,
      p_date_of_birth: parsed.data.date_of_birth,
      p_guardian_phone: phone,
      p_birth_registration_no: parsed.data.birth_registration_no || null,
    });

    if (matches && matches.length > 0) {
      return {
        duplicates: matches.map((m) => ({
          id: m.m_id,
          child_id: m.m_child_id,
          full_name: m.m_full_name,
          date_of_birth: m.m_date_of_birth,
          guardian_name: m.m_guardian_name,
          reason: m.m_reason,
          confidence: m.m_confidence,
        })),
      };
    }
  }

  // The guardian is a domain record, not a login. Creating one here is the normal path: the
  // overwhelming majority of children are registered from a guardian with no smartphone, no
  // email and no account, who may claim one later with the Child ID (FR-15).
  let guardianId = parsed.data.guardian_id;
  if (!guardianId) {
    const { data: g, error: gErr } = await supabase
      .from("guardians")
      .insert({
        full_name: parsed.data.guardian_name,
        phone: parsed.data.guardian_phone,
        relationship: parsed.data.guardian_relationship,
        location_id: parsed.data.location_id,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (gErr || !g) return { error: "অভিভাবকের তথ্য সংরক্ষণ করা যায়নি।" };
    guardianId = g.id;
  }

  const { data, error } = await supabase
    .from("children")
    .insert({
      full_name: parsed.data.full_name,
      date_of_birth: parsed.data.date_of_birth,
      gender: parsed.data.gender,
      guardian_id: guardianId,
      location_id: parsed.data.location_id,
      birth_registration_no: parsed.data.birth_registration_no || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.message.includes("children_brn_key")) {
      return { error: "এই জন্ম নিবন্ধন নম্বরে ইতিমধ্যে একটি শিশু নিবন্ধিত আছে।" };
    }
    if (error?.message.includes("row-level security")) {
      return { error: "এই এলাকায় শিশু নিবন্ধনের অনুমতি নেই — আপনার দায়িত্বের এলাকা দেখুন।" };
    }
    return { error: "নিবন্ধন ব্যর্থ হয়েছে — আবার চেষ্টা করুন।" };
  }

  revalidatePath("/admin/children");
  revalidatePath("/worker");

  // The confirmation is the Child ID itself — the worker has to write it on the vaccination
  // card, and it is what the guardian later uses to claim the record.
  const role = await getUserRole(supabase);
  redirect(role === "admin" ? `/admin/children/${data.id}` : `/worker?registered=${data.id}`);
}
