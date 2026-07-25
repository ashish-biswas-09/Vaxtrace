"use server";

import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type NoteState = { error?: string; ok?: boolean } | undefined;

// Only the two amendable fields. Everything clinical (child, vaccine, dose, date, who gave
// it) is append-only — that is what makes the history admissible. Column-level UPDATE grants
// in 20260725100100 enforce the same rule at the database, so this schema is the second
// line, not the only one.
const schema = z.object({
  record_id: z.string().uuid(),
  child_id: z.string().uuid(),
  notes: z.string().trim().max(500),
  adverse_event: z.string().trim().max(500),
});

export async function saveDoseNoteAction(
  _prev: NoteState,
  formData: FormData,
): Promise<NoteState> {
  const parsed = schema.safeParse({
    record_id: formData.get("record_id"),
    child_id: formData.get("child_id"),
    notes: formData.get("notes") ?? "",
    adverse_event: formData.get("adverse_event") ?? "",
  });
  if (!parsed.success) return { error: "তথ্য সঠিক নয় — সর্বোচ্চ ৫০০ অক্ষর।" };

  const supabase = await requireRole("admin");
  const { error } = await supabase
    .from("vaccination_records")
    .update({
      // Empty string clears the field; the CHECK constraint rejects '' but accepts NULL.
      notes: parsed.data.notes || null,
      adverse_event: parsed.data.adverse_event || null,
    })
    .eq("id", parsed.data.record_id);

  if (error) return { error: "সংরক্ষণ ব্যর্থ হয়েছে।" };

  revalidatePath(`/admin/children/${parsed.data.child_id}`);
  return { ok: true };
}
