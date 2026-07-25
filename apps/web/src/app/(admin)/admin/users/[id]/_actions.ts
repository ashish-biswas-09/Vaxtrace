"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type AssignmentState = { error?: string; ok?: string } | undefined;

const grantSchema = z
  .object({
    user_id: z.string().uuid(),
    role: z.enum([
      "guardian",
      "field_worker",
      "store_keeper",
      "supervisor",
      "programme_manager",
      "system_admin",
    ]),
    location_id: z.string().uuid().or(z.literal("")),
    facility_id: z.string().uuid().or(z.literal("")),
    valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  })
  .refine((v) => v.location_id !== "" || v.facility_id !== "", {
    message: "একটি এলাকা বা কেন্দ্র নির্বাচন করুন",
  });

// Grants a posting: role × scope (report §10). Everything that decides whether this grant is
// *allowed* lives in the database — trg_assignment_guard rejects granting above your own
// rank or outside your own scope, and the RLS policy additionally requires a verified second
// factor. This action's job is to shape the input and to translate a refusal into Bangla.
//
// That division matters: an admin who reaches the table through psql, the REST API or a
// future importer meets exactly the same rules.
export async function grantAssignmentAction(
  _prev: AssignmentState,
  formData: FormData,
): Promise<AssignmentState> {
  const parsed = grantSchema.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role"),
    location_id: formData.get("location_id") ?? "",
    facility_id: formData.get("facility_id") ?? "",
    valid_to: formData.get("valid_to") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const { supabase } = await requireAppRole("programme_manager");

  const { error } = await supabase.from("user_assignments").insert({
    user_id: parsed.data.user_id,
    role: parsed.data.role,
    location_id: parsed.data.location_id || null,
    facility_id: parsed.data.facility_id || null,
    valid_to: parsed.data.valid_to || null,
  });

  if (error) return { error: assignmentError(error.message) };

  revalidatePath(`/admin/users/${parsed.data.user_id}`);
  revalidatePath("/admin/users");
  return { ok: "দায়িত্ব বরাদ্দ হয়েছে।" };
}

const revokeSchema = z.object({
  assignment_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

// Revocation closes the assignment rather than deleting it. A deleted posting is a posting
// that never appears in an audit answer to "who could see this child last March", and the
// whole point of valid_from/valid_to is that the answer stays reconstructable.
export async function revokeAssignmentAction(
  _prev: AssignmentState,
  formData: FormData,
): Promise<AssignmentState> {
  const parsed = revokeSchema.safeParse({
    assignment_id: formData.get("assignment_id"),
    user_id: formData.get("user_id"),
  });
  if (!parsed.success) return { error: "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("programme_manager");

  const { error } = await supabase
    .from("user_assignments")
    .update({ valid_to: new Date().toISOString().slice(0, 10) })
    .eq("id", parsed.data.assignment_id);

  if (error) return { error: assignmentError(error.message) };

  revalidatePath(`/admin/users/${parsed.data.user_id}`);
  revalidatePath("/admin/users");
  return { ok: "দায়িত্ব প্রত্যাহার হয়েছে।" };
}

// The database raises these in English, deliberately: they are exception messages, not user
// copy. Translating them here keeps the rule in one place and the wording in another.
function assignmentError(message: string): string {
  if (message.includes("above your own")) {
    return "নিজের চেয়ে উঁচু ভূমিকা বরাদ্দ করা যাবে না।";
  }
  if (message.includes("outside your own scope")) {
    return "নিজের এলাকার বাইরে দায়িত্ব বরাদ্দ করা যাবে না।";
  }
  if (message.includes("system_admin")) {
    return "শুধু সিস্টেম অ্যাডমিন সিস্টেম অ্যাডমিন ভূমিকা দিতে পারেন।";
  }
  if (message.includes("duplicate key") || message.includes("user_assignments_live_key")) {
    return "এই দায়িত্ব ইতিমধ্যে বরাদ্দ করা আছে।";
  }
  // The RLS policy on user_assignments requires mfa_satisfied(); a denial with no matching
  // row is what an un-enrolled manager sees.
  if (message.includes("row-level security") || message.includes("violates")) {
    return "অনুমতি নেই — দুই-ধাপ যাচাই চালু আছে কি না দেখুন (অ্যাকাউন্ট › নিরাপত্তা)।";
  }
  return "দায়িত্ব পরিবর্তন ব্যর্থ হয়েছে।";
}
