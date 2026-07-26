"use server";

import { getUserRole, requireUser, roleLandingPath } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ScopeState = { error?: string } | undefined;

const schema = z.object({ location_id: z.string().uuid("এলাকা নির্বাচন করুন") });

// Sets the user's working area (report §13.1, "scope selection when a user holds several").
//
// IMPORTANT, and stated on the screen too: this is a VIEW preference, not a permission
// boundary. auth_scopes() always returns every live assignment a user holds, and RLS always
// honours the union of them — narrowing here changes which area the console opens on and
// which area a newly registered child inherits, and nothing else. A selector that looked like
// it dropped privileges but did not would be worse than no selector at all.
export async function setWorkingAreaAction(
  _prev: ScopeState,
  formData: FormData,
): Promise<ScopeState> {
  const parsed = schema.safeParse({ location_id: formData.get("location_id") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("profiles")
    .update({ default_location_id: parsed.data.location_id })
    .eq("id", user.id);

  if (error) return { error: "কর্মএলাকা সংরক্ষণ করা যায়নি।" };

  revalidatePath("/", "layout");
  const role = await getUserRole(supabase);
  redirect(role ? roleLandingPath(role) : "/");
}
