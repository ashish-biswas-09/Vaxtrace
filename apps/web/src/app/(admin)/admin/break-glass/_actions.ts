"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ReviewState = { error?: string; ok?: string } | undefined;

const schema = z.object({ id: z.string().uuid() });

// Marking a break-glass event reviewed. Deliberately not "approve" or "reject": the access
// already happened and cannot be undone by a click. What this records is that a supervisor
// looked at it — which is the only thing a review of a past event can honestly assert.
//
// The reviewer is stamped server-side from the session, never from the form, and the RLS
// policy separately requires supervisor or above.
export async function reviewBreakGlassAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const parsed = schema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("supervisor");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("break_glass_access")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
    .eq("id", parsed.data.id);

  if (error) return { error: "পর্যালোচনা রেকর্ড করা যায়নি।" };

  revalidatePath("/admin/break-glass");
  return { ok: "পর্যালোচিত হিসেবে চিহ্নিত হয়েছে।" };
}
