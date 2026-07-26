"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { dateBn, toBn, todayIso } from "@/lib/format";
import {
  OUTCOMES_THAT_CLOSE_THE_CHILD,
  TRACING_OUTCOME_BN,
  TRACING_STATUS_BN,
} from "@/lib/programme";
import { DataTable, type Column } from "../../_components/DataTable";
import { FormMessage, StatusBadge, SubmitButton } from "../../_components/ui";
import {
  assignTaskAction,
  closeTaskAction,
  type TracingState,
} from "../_actions";

type Status = Database["public"]["Enums"]["tracing_status"];
type Outcome = Database["public"]["Enums"]["tracing_outcome"];

export type TaskRow = {
  id: string;
  status: Status;
  child_id: string;
  child_code: string;
  full_name: string;
  area: string;
  guardian_name: string;
  guardian_phone: string;
  address: string;
  assignee_id: string | null;
  assignee_name: string | null;
  due_by: string | null;
  doses_missed: number;
  days_overdue: number;
  outcome: Outcome | null;
  outcome_note: string | null;
  is_late: boolean;
};

export function TracingBoard({
  rows,
  assignees,
  closedCount,
}: {
  rows: TaskRow[];
  assignees: { id: string; name: string }[];
  closedCount: number;
}) {
  // Which row's panel is open. One at a time: two open forms on a board this dense is how a
  // supervisor assigns the wrong child.
  const [openRow, setOpenRow] = useState<string | null>(null);

  const columns: Column<TaskRow>[] = [
    {
      header: "শিশু",
      cell: (r) => (
        <div>
          <Link href={`/admin/children/${r.child_id}`} className="text-[var(--color-primary)]">
            {r.full_name}
          </Link>
          <span className="block font-mono text-[11px] text-[var(--color-muted)]">
            {r.child_code}
          </span>
        </div>
      ),
    },
    {
      header: "অবস্থা",
      cell: (r) => (
        <StatusBadge tone={r.is_late ? "danger" : TRACING_STATUS_BN[r.status].tone}>
          {TRACING_STATUS_BN[r.status].label}
          {r.is_late ? " · বিলম্বিত" : ""}
        </StatusBadge>
      ),
    },
    {
      header: "বাকি ডোজ",
      align: "right",
      cell: (r) => (
        <span title={`${r.days_overdue} দিন দেরি`}>
          {toBn(r.doses_missed)}
          <span className="ml-1 text-xs text-[var(--color-muted)]">
            ({toBn(r.days_overdue)} দিন)
          </span>
        </span>
      ),
    },
    { header: "এলাকা", cell: (r) => <span className="text-xs">{r.area}</span> },
    {
      header: "অভিভাবক",
      cell: (r) => (
        <div className="text-xs">
          {r.guardian_name}
          <a href={`tel:${r.guardian_phone}`} className="block font-mono">
            {r.guardian_phone}
          </a>
        </div>
      ),
    },
    { header: "ঠিকানা", cell: (r) => <span className="text-xs">{r.address}</span> },
    {
      header: "দায়িত্বপ্রাপ্ত",
      cell: (r) =>
        r.assignee_name ? (
          <div className="text-xs">
            {r.assignee_name}
            {r.due_by && <span className="block text-[var(--color-muted)]">{dateBn(r.due_by)}</span>}
          </div>
        ) : (
          <span className="text-xs text-[var(--color-muted)]">—</span>
        ),
    },
    {
      header: "ফলাফল",
      cell: (r) =>
        r.outcome ? (
          <span className="text-xs" title={r.outcome_note ?? undefined}>
            {TRACING_OUTCOME_BN[r.outcome]}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpenRow(openRow === r.id ? null : r.id)}
            aria-expanded={openRow === r.id}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs print:hidden"
          >
            {r.status === "open" ? "বরাদ্দ / নিষ্পন্ন" : "ফলাফল লিখুন"}
          </button>
        ),
    },
  ];

  const active = rows.find((r) => r.id === openRow) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) =>
          `${r.full_name} ${r.child_code} ${r.guardian_name} ${r.guardian_phone} ${r.area} ${r.assignee_name ?? ""}`
        }
        searchPlaceholder="শিশু, অভিভাবক, এলাকা বা কর্মী…"
        filters={[
          { label: "অপেক্ষমাণ", predicate: (r) => r.status === "open" },
          { label: "বরাদ্দকৃত", predicate: (r) => r.status === "assigned" },
          { label: "বিলম্বিত", predicate: (r) => r.is_late },
          { label: "নিষ্পন্ন", predicate: (r) => r.status === "closed" },
        ]}
        empty="বোর্ডে কোনো কাজ নেই।"
        pageSize={30}
      />

      {closedCount > 0 && (
        <p className="text-xs text-[var(--color-muted)] print:hidden">
          {toBn(closedCount)} টি কাজ নিষ্পন্ন হয়েছে। নিষ্পন্ন কাজ মুছে ফেলা হয় না — কে কখন কোথায়
          গিয়েছিল, সেটাই পরের প্রান্তিকে রুট পরিকল্পনার ভিত্তি।
        </p>
      )}

      {active && (
        <section className="rounded-xl border border-[var(--color-primary)] p-5 print:hidden">
          <h2 className="text-lg font-medium">
            {active.full_name}{" "}
            <span className="font-mono text-sm text-[var(--color-muted)]">{active.child_code}</span>
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {active.address} · {active.guardian_name} · {active.guardian_phone}
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <AssignForm taskId={active.id} assignees={assignees} currentDue={active.due_by} />
            <CloseForm taskId={active.id} />
          </div>
        </section>
      )}
    </div>
  );
}

function AssignForm({
  taskId,
  assignees,
  currentDue,
}: {
  taskId: string;
  assignees: { id: string; name: string }[];
  currentDue: string | null;
}) {
  const [state, save] = useActionState<TracingState, FormData>(assignTaskAction, undefined);

  return (
    <form action={save} className="flex flex-col gap-3">
      <h3 className="font-medium">কাকে পাঠানো হবে</h3>
      <input type="hidden" name="task_id" value={taskId} />

      <label className="text-xs text-[var(--color-muted)]">
        কর্মী
        <select
          name="assigned_to"
          required
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="" className="text-black">
            নির্বাচন করুন…
          </option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id} className="text-black">
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[var(--color-muted)]">
        কবের মধ্যে
        <input
          type="date"
          name="due_by"
          required
          min={todayIso()}
          defaultValue={currentDue ?? ""}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <FormMessage error={state?.error} ok={state?.ok} />
      <SubmitButton pendingLabel="বরাদ্দ হচ্ছে…">দায়িত্ব বরাদ্দ করুন</SubmitButton>
    </form>
  );
}

function CloseForm({ taskId }: { taskId: string }) {
  const [state, save] = useActionState<TracingState, FormData>(closeTaskAction, undefined);
  const [outcome, setOutcome] = useState<Outcome | "">("");

  // Three of the seven outcomes change the child's lifecycle in the database — reminders stop,
  // the child leaves the defaulter list and the denominator. Saying so before the click is the
  // difference between a control and a surprise.
  const closesChild = outcome !== "" && OUTCOMES_THAT_CLOSE_THE_CHILD.includes(outcome);

  return (
    <form action={save} className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
      <h3 className="font-medium">দরজায় কী হলো</h3>
      <input type="hidden" name="task_id" value={taskId} />

      <label className="text-xs text-[var(--color-muted)]">
        ফলাফল
        <select
          name="outcome"
          required
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as Outcome)}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="" className="text-black">
            নির্বাচন করুন…
          </option>
          {(Object.keys(TRACING_OUTCOME_BN) as Outcome[]).map((o) => (
            <option key={o} value={o} className="text-black">
              {TRACING_OUTCOME_BN[o]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[var(--color-muted)]">
        মন্তব্য
        <textarea
          name="outcome_note"
          rows={2}
          maxLength={400}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      {closesChild && (
        <p className="rounded-md border border-[var(--color-warning)] px-3 py-2 text-xs text-[var(--color-warning)]">
          এই ফলাফল সংরক্ষণ করলে শিশুটির অবস্থাও পরিবর্তিত হবে — সব রিমাইন্ডার বন্ধ হবে এবং সে
          ডিফল্টার তালিকা থেকে সরে যাবে। ভুল হলে শিশুর পাতা থেকে অবস্থা আবার পরিবর্তন করতে হবে।
        </p>
      )}

      <FormMessage error={state?.error} ok={state?.ok} />
      <SubmitButton
        variant={closesChild ? "danger" : "primary"}
        pendingLabel="সংরক্ষণ হচ্ছে…"
      >
        ফলাফল সংরক্ষণ ও নিষ্পন্ন
      </SubmitButton>
    </form>
  );
}
