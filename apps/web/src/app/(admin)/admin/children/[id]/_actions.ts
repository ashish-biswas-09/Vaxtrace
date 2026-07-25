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

// ---------------------------------------------------------------------------
// Child lifecycle (BS-06 / FR-18 / FR-36)
// ---------------------------------------------------------------------------
const statusSchema = z.object({
  child_id: z.string().uuid(),
  status: z.enum(["active", "moved_out", "transferred", "refused", "deceased", "aged_out"]),
  reason: z.string().trim().max(300),
});

export type ChildStatusState = { error?: string; ok?: string } | undefined;

// A child, once inserted, used to be `active` forever: reminders never stopped, denominators
// inflated with children who had left the catchment or died, and dropout was permanently
// overstated.
//
// The consequential half of this happens in the database. trg_child_status_history writes the
// transition and, for any status that is not reachable, marks every queued notification for
// that child `dead` in the same transaction. That is what makes FR-56 true — a system that
// texts a bereaved family "your child's next vaccine is due" has failed in a way no coverage
// metric captures, and "we stop at the next nightly run" is not stopping.
export async function setChildStatusAction(
  _prev: ChildStatusState,
  formData: FormData,
): Promise<ChildStatusState> {
  const parsed = statusSchema.safeParse({
    child_id: formData.get("child_id"),
    status: formData.get("status"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "তথ্য সঠিক নয়" };

  // A status change that stops all messaging is not something to record without saying why.
  if (parsed.data.status !== "active" && parsed.data.reason.length < 3) {
    return { error: "কারণ লিখুন — কেন অবস্থা পরিবর্তন করছেন।" };
  }

  const supabase = await requireRole("admin");

  const { error } = await supabase
    .from("children")
    .update({
      status: parsed.data.status,
      status_reason: parsed.data.reason || null,
    })
    .eq("id", parsed.data.child_id);

  if (error) return { error: "অবস্থা পরিবর্তন ব্যর্থ হয়েছে।" };

  revalidatePath(`/admin/children/${parsed.data.child_id}`);
  revalidatePath("/admin/children");
  return { ok: "অবস্থা পরিবর্তন হয়েছে।" };
}
