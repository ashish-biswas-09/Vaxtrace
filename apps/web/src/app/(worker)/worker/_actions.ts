"use server";

import { getUserRole, requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type RegisterState = { error?: string } | undefined;

const schema = z.object({
  full_name: z.string().trim().min(1, "শিশুর নাম লিখুন").max(120),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "জন্মতারিখ সঠিক নয়"),
  gender: z.enum(["male", "female", "other"]),
  guardian_id: z.string().uuid("অভিভাবক নির্বাচন করুন"),
  guardian_contact: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^\+?[0-9\s-]{6,20}$/.test(v), { message: "ফোন নম্বর সঠিক নয়" }),
});

// Registering a child is the moment the whole system starts for that child: the insert fires
// child_id_guard (mints the immutable 10-digit Child ID) and child_after_insert (generates
// the full NIS schedule from the date of birth). Neither is done here — doing it in app code
// would mean a child registered by any other path silently has no ID and no schedule.
//
// requireUser, not requireRole: workers and admins may both register, and RLS
// (children_insert) is what actually decides. A parent self-registering their own child also
// passes, because the policy allows guardian_id = auth.uid().
export async function registerChildAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    date_of_birth: formData.get("date_of_birth"),
    gender: formData.get("gender"),
    guardian_id: formData.get("guardian_id"),
    guardian_contact: formData.get("guardian_contact") ?? "",
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

  const { data, error } = await supabase
    .from("children")
    .insert({
      full_name: parsed.data.full_name,
      date_of_birth: parsed.data.date_of_birth,
      gender: parsed.data.gender,
      guardian_id: parsed.data.guardian_id,
      guardian_contact: parsed.data.guardian_contact || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "নিবন্ধন ব্যর্থ হয়েছে — আবার চেষ্টা করুন।" };

  revalidatePath("/admin/children");
  revalidatePath("/worker");

  // The confirmation is the Child ID itself — the worker has to write it on the vaccination
  // card. An admin gets the full record; a worker cannot enter the admin subtree, so they
  // land back on their console with the new child highlighted.
  const role = await getUserRole(supabase);
  redirect(role === "admin" ? `/admin/children/${data.id}` : `/worker?registered=${data.id}`);
}
