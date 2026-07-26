"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type TracingState = { error?: string; ok?: string } | undefined;

const OUTCOMES = [
  "vaccinated",
  "appointment_given",
  "refused",
  "moved_away",
  "deceased",
  "not_found",
  "unreachable",
] as const;

// Raise the board on demand. The refusal path matters as much as the success path: the RPC
// carries its own rate limit and its own role check, so what this has to do is turn a Postgres
// exception into a sentence rather than swallow it.
export async function refreshBoardAction(): Promise<TracingState> {
  const { supabase } = await requireAppRole("supervisor");

  const { data, error } = await supabase.rpc("refresh_tracing_board", { p_due_in_days: 7 });
  if (error) {
    return {
      error: error.message.includes("Too many")
        ? "এক ঘণ্টায় অনেকবার তালিকা তৈরি করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।"
        : "তালিকা তৈরি করা যায়নি।",
    };
  }

  revalidatePath("/admin/tracing");
  return {
    ok:
      Number(data ?? 0) > 0
        ? `${data} টি নতুন ফলো-আপ কাজ যোগ হয়েছে।`
        : "নতুন কোনো ফলো-আপ কাজ নেই — সব ডিফল্টার ইতিমধ্যে তালিকায় আছে।",
  };
}

const assignSchema = z.object({
  task_id: z.string().uuid(),
  assigned_to: z.string().uuid("একজন কর্মী নির্বাচন করুন"),
  due_by: z.string().min(1, "কবের মধ্যে পরিদর্শন হবে তা দিন"),
});

export async function assignTaskAction(
  _prev: TracingState,
  formData: FormData,
): Promise<TracingState> {
  const parsed = assignSchema.safeParse({
    task_id: formData.get("task_id"),
    assigned_to: formData.get("assigned_to"),
    due_by: formData.get("due_by"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("supervisor");

  // status and assigned_at move together — the trigger stamps the timestamp, the constraint
  // forbids an assigned task with no assignee, so neither can be forgotten here.
  const { error } = await supabase
    .from("tracing_tasks")
    .update({
      status: "assigned",
      assigned_to: parsed.data.assigned_to,
      due_by: parsed.data.due_by,
    })
    .eq("id", parsed.data.task_id);

  if (error) return { error: "দায়িত্ব বরাদ্দ করা যায়নি।" };

  revalidatePath("/admin/tracing");
  return { ok: "দায়িত্ব বরাদ্দ হয়েছে।" };
}

const closeSchema = z.object({
  task_id: z.string().uuid(),
  outcome: z.enum(OUTCOMES),
  outcome_note: z.string().trim().max(400).optional(),
});

// Closing the loop. The database does the consequential half — trg_tracing_outcome() moves the
// child's lifecycle when the outcome says the family has gone — so this stays a plain update
// and there is exactly one place that rule lives.
export async function closeTaskAction(
  _prev: TracingState,
  formData: FormData,
): Promise<TracingState> {
  const parsed = closeSchema.safeParse({
    task_id: formData.get("task_id"),
    outcome: formData.get("outcome"),
    outcome_note: formData.get("outcome_note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ফলাফল নির্বাচন করুন" };

  const { supabase } = await requireAppRole("field_worker");

  const { error } = await supabase
    .from("tracing_tasks")
    .update({
      status: "closed",
      outcome: parsed.data.outcome,
      outcome_note: parsed.data.outcome_note ?? null,
    })
    .eq("id", parsed.data.task_id);

  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "এই কাজটি আপনার দায়িত্বের ভেতরে নেই।"
        : "ফলাফল সংরক্ষণ করা যায়নি।",
    };
  }

  revalidatePath("/admin/tracing");
  revalidatePath("/admin/children");
  return { ok: "ফলাফল সংরক্ষিত হয়েছে এবং কাজটি নিষ্পন্ন হয়েছে।" };
}
