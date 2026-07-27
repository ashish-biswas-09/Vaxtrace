"use client";

import { useActionState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { dateBn, toBn } from "@/lib/format";
import { REQUISITION_STATUS_BN } from "@/lib/programme";
import { ConfirmButton, EmptyState, FormMessage, StatusBadge, SubmitButton } from "@/components/ui/kit";
import {
  confirmReceiptAction,
  decideRequisitionAction,
  issueRequisitionAction,
  type RequisitionState,
} from "../_actions";

export type RequisitionRow = {
  id: string;
  code: string;
  status: Database["public"]["Enums"]["requisition_status"];
  from: string;
  to: string;
  needed_by: string;
  is_late: boolean;
  note: string | null;
  decision_note: string | null;
  lines: {
    vaccine_id: string;
    vaccine: string;
    requested: number;
    approved: number | null;
    issued: number | null;
  }[];
};

// A card list rather than a table: a requisition is a small document with lines and a decision
// on it, and flattening that into a row loses the lines — which are the part somebody has to
// read before approving.
export function RequisitionList({ rows }: { rows: RequisitionRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="কোনো চাহিদাপত্র নেই"
        hint="কেন্দ্র থেকে টিকা চাওয়া হলে সেটি এখানে আসবে, এবং সিদ্ধান্ত ও প্রেরণের হিসাব এখানেই থাকবে।"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r) => (
        <li
          key={r.id}
          className="print-keep rounded-xl border border-[var(--color-border)] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                <span className="font-mono text-sm">{r.code}</span>
                <span className="mx-2 text-[var(--color-muted)]">·</span>
                {r.from} → {r.to}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                প্রয়োজন {dateBn(r.needed_by)}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            </div>
            <StatusBadge tone={r.is_late ? "danger" : REQUISITION_STATUS_BN[r.status].tone}>
              {REQUISITION_STATUS_BN[r.status].label}
              {r.is_late ? " · বিলম্বিত" : ""}
            </StatusBadge>
          </div>

          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-[var(--color-muted)]">
              <tr>
                <th scope="col" className="pb-1 font-medium">টিকা</th>
                <th scope="col" className="pb-1 text-right font-medium">চাওয়া</th>
                <th scope="col" className="pb-1 text-right font-medium">অনুমোদিত</th>
                <th scope="col" className="pb-1 text-right font-medium">প্রেরিত</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => (
                <tr key={l.vaccine_id} className="border-t border-[var(--color-border)]">
                  <td className="py-1.5">{l.vaccine}</td>
                  <td className="py-1.5 text-right tabular-nums">{toBn(l.requested)}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {l.approved == null ? "—" : toBn(l.approved)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {l.issued == null ? "—" : toBn(l.issued)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {r.decision_note && (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              সিদ্ধান্তের মন্তব্য: {r.decision_note}
            </p>
          )}

          <div className="mt-4 print:hidden">
            {r.status === "submitted" && <DecideForm row={r} />}
            {r.status === "approved" && <IssueForm id={r.id} code={r.code} />}
            {r.status === "issued" && <ReceiveForm id={r.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DecideForm({ row }: { row: RequisitionRow }) {
  const [state, save] = useActionState<RequisitionState, FormData>(
    decideRequisitionAction,
    undefined,
  );
  const first = row.lines[0];

  return (
    <form action={save} className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4">
      <input type="hidden" name="requisition_id" value={row.id} />
      {first && <input type="hidden" name="vaccine_id" value={first.vaccine_id} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-[var(--color-muted)]">
          অনুমোদিত পরিমাণ
          <input
            type="number"
            name="approved"
            min={0}
            defaultValue={first?.requested ?? 0}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-[var(--color-muted)] sm:col-span-2">
          মন্তব্য (প্রত্যাখ্যান করলে আবশ্যক)
          <input
            name="decision_note"
            maxLength={300}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      <FormMessage error={state?.error} ok={state?.ok} />

      <div className="flex flex-wrap gap-2">
        {/* Both buttons submit the same form and the decision rides on the submitter's own
            name/value. Deliberately not a hidden field: a hidden field is always submitted, so
            it would win `formData.get("decision")` and every rejection would post as an
            approval. */}
        <SubmitButton name="decision" value="approved" pendingLabel="সংরক্ষণ হচ্ছে…">
          অনুমোদন করুন
        </SubmitButton>
        <ConfirmButton
          label="প্রত্যাখ্যান"
          title="চাহিদাপত্র প্রত্যাখ্যান করবেন?"
          body="চাহিদাকারী কেন্দ্র শুধু আপনার মন্তব্যটুকুই দেখতে পাবে, তাই কারণটি স্পষ্ট লিখুন। প্রত্যাখ্যানের পর একই চাহিদাপত্র আর অনুমোদন করা যাবে না — নতুন চাহিদাপত্র দিতে হবে।"
          confirmLabel="প্রত্যাখ্যান করুন"
          name="decision"
          value="rejected"
        />
      </div>
    </form>
  );
}

function IssueForm({ id, code }: { id: string; code: string }) {
  const [state, save] = useActionState<RequisitionState, FormData>(
    issueRequisitionAction,
    undefined,
  );

  return (
    <form action={save} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="requisition_id" value={id} />
      <ConfirmButton
        label="প্রেরণ করুন"
        title={`${code} প্রেরণ করবেন?`}
        body="মেয়াদ সবচেয়ে আগে শেষ হবে এমন ব্যাচ থেকে (FEFO) ডোজ কাটা হবে, গ্রহণকারী কেন্দ্রে একই ব্যাচের হিসাব যোগ হবে, এবং দুই গুদামের লেজারেই সারি লেখা হবে। লেজারের সারি মোছা যায় না।"
        confirmLabel="প্রেরণ নিশ্চিত করুন"
        variant="primary"
      />
      <FormMessage error={state?.error} ok={state?.ok} />
    </form>
  );
}

function ReceiveForm({ id }: { id: string }) {
  const [state, save] = useActionState<RequisitionState, FormData>(
    confirmReceiptAction,
    undefined,
  );

  return (
    <form action={save} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="requisition_id" value={id} />
      <SubmitButton variant="ghost" pendingLabel="…">
        গ্রহণ নিশ্চিত করুন
      </SubmitButton>
      <FormMessage error={state?.error} ok={state?.ok} />
    </form>
  );
}
