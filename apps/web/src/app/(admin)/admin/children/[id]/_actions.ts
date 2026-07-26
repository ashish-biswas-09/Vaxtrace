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
// Voiding a dose (FR-31 / BUG-05 follow-through)
// ---------------------------------------------------------------------------
export type VoidState = { error?: string; ok?: string } | undefined;

const voidSchema = z.object({
  record_id: z.string().uuid(),
  child_id: z.string().uuid(),
  void_reason: z.string().trim().min(3, "বাতিলের কারণ লিখুন").max(300),
});

// A clinical record is never deleted. A wrong one is voided: the row stays, carries who voided
// it and why, stops counting in coverage and dropout, and frees its slot so the correction can
// be recorded. The schema has supported this since 20260726100000 — until now nothing offered
// it, so the only way to correct a mis-entered dose was to leave it wrong.
//
// Two things happen in the database as a consequence, and neither is duplicated here: the void
// guard rejects the write unless the caller is a supervisor or above, and the stock trigger
// writes a compensating ledger entry so the batch balance follows the correction.
export async function voidDoseAction(
  _prev: VoidState,
  formData: FormData,
): Promise<VoidState> {
  const parsed = voidSchema.safeParse({
    record_id: formData.get("record_id"),
    child_id: formData.get("child_id"),
    void_reason: formData.get("void_reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const supabase = await requireRole("admin");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "সেশন পাওয়া যায়নি।" };

  const { error } = await supabase
    .from("vaccination_records")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: user.id,
      void_reason: parsed.data.void_reason,
    })
    .eq("id", parsed.data.record_id)
    .is("voided_at", null);

  if (error) {
    return {
      error:
        error.message.includes("supervis") || error.message.includes("row-level security")
          ? "ডোজ বাতিল করা সুপারভাইজার বা তার ঊর্ধ্বতনের কাজ।"
          : "ডোজ বাতিল করা যায়নি।",
    };
  }

  revalidatePath(`/admin/children/${parsed.data.child_id}`);
  revalidatePath("/admin/reports");
  return { ok: "ডোজটি বাতিল হিসেবে চিহ্নিত হয়েছে।" };
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
