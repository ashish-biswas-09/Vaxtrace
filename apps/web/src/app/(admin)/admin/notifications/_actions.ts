"use server";

import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { revalidatePath } from "next/cache";

export type RunState = { error?: string; ok?: string } | undefined;

// Manual enqueue. Safe to press twice: enqueue_reminders() is guarded by the
// unique(schedule_id, channel, due_date) constraint, so a second run inserts nothing rather
// than double-queueing a guardian.
//
// This is a privileged trigger, so it is auditable — but the audit entry is written by the
// notifications insert path itself rather than by a hand-rolled log line here, which is why
// there is no explicit audit() call: rows are the evidence.
export async function runRemindersAction(): Promise<RunState> {
  const supabase = await requireRole("admin");

  const { data, error } = await supabase.rpc("enqueue_reminders");
  if (error) return { error: "সারি তৈরি ব্যর্থ হয়েছে।" };

  const queued = data ?? 0;
  revalidatePath("/admin/notifications");
  return {
    ok:
      queued > 0
        ? `${toBn(queued)}টি নতুন রিমাইন্ডার সারিবদ্ধ হয়েছে।`
        : "নতুন কিছু সারিবদ্ধ হয়নি — লিড টাইমের মধ্যে কোনো ডোজ দেয় নেই।",
  };
}
