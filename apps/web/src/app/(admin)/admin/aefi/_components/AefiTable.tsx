"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { dateBn } from "@/lib/format";
import {
  AEFI_CAUSALITY_BN,
  AEFI_OUTCOME_BN,
  AEFI_SEVERITY_BN,
  AEFI_SEVERITY_HINT_BN,
  AEFI_STATUS_BN,
  aefiNextStatuses,
  isSeverityDowngrade,
} from "@/lib/programme";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormDialog } from "@/components/ui/FormDialog";
import { FormMessage, StatusBadge, SubmitButton } from "@/components/ui/kit";
import { useToast } from "@/components/ui/Toast";
import { classifyCaseAction, severityReasonAction, type AefiState } from "../_actions";

type Severity = Database["public"]["Enums"]["aefi_severity"];
type Status = Database["public"]["Enums"]["aefi_status"];
type Causality = Database["public"]["Enums"]["aefi_causality"];
type Outcome = Database["public"]["Enums"]["aefi_outcome"];

export type AefiRow = {
  id: string;
  code: string;
  status: Status;
  severity: Severity;
  outcome: Outcome;
  causality: Causality | null;
  onset_date: string;
  symptoms: string;
  note: string | null;
  child_id: string;
  child_code: string;
  child_name: string;
  area: string;
  facility: string;
  vaccine: string;
  batch: string | null;
  reported_by: string;
  investigated_by: string | null;
  overdue: boolean;
};

const isOpen = (s: Status) => s === "reported" || s === "under_investigation";

// Rows arrive filtered, ordered by urgency and paged by the server. Every case can be opened —
// a classified case still has an outcome to record and a closure to make (K-15).
export function AefiTable({ rows, empty }: { rows: AefiRow[]; empty: string }) {
  const [openRow, setOpenRow] = useState<AefiRow | null>(null);

  const columns: Column<AefiRow>[] = [
    {
      header: "কেস",
      cell: (r) => (
        <div>
          <span className="font-mono text-xs whitespace-nowrap">{r.code}</span>
          <span className="block text-xs whitespace-nowrap text-[var(--text-muted)]">
            {dateBn(r.onset_date)}
          </span>
        </div>
      ),
    },
    {
      header: "শিশু",
      cell: (r) => (
        <Link href={`/admin/children/${r.child_id}`} className="text-[var(--accent)]">
          {r.child_name}
        </Link>
      ),
    },
    {
      header: "মাত্রা",
      cell: (r) => (
        <StatusBadge tone={AEFI_SEVERITY_BN[r.severity].tone}>{AEFI_SEVERITY_BN[r.severity].label}</StatusBadge>
      ),
    },
    {
      header: "অবস্থা",
      cell: (r) => (
        <StatusBadge tone={r.overdue ? "danger" : AEFI_STATUS_BN[r.status].tone}>
          {AEFI_STATUS_BN[r.status].label}
          {r.overdue ? " · বিলম্বিত" : ""}
        </StatusBadge>
      ),
    },
    {
      header: "উপসর্গ",
      cell: (r) => (
        <span className="text-xs">
          {r.symptoms.length > 60 ? `${r.symptoms.slice(0, 60)}…` : r.symptoms}
        </span>
      ),
    },
    { header: "টিকা", cell: (r) => <span className="text-xs">{r.vaccine}</span> },
    {
      header: "ব্যাচ",
      // The recall link. "Which children reacted to BCG-2211" is the question asked at three
      // in the morning, and this column is the only reason it is answerable.
      cell: (r) =>
        r.batch ? <span className="font-mono text-xs whitespace-nowrap">{r.batch}</span> : <span>—</span>,
    },
    {
      header: "কার্যকারণ",
      cell: (r) =>
        r.causality ? (
          <span className="text-xs">{AEFI_CAUSALITY_BN[r.causality]}</span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">নির্ধারিত হয়নি</span>
        ),
    },
    {
      header: "",
      align: "right",
      cell: (r) => (
        // One line and one width for every row, so the column reads as a column.
        <Button
          size="sm"
          variant={isOpen(r.status) ? "primary" : "secondary"}
          onClick={() => setOpenRow(r)}
          className="w-24 whitespace-nowrap"
        >
          {isOpen(r.status) ? "তদন্ত করুন" : "খুলুন"}
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} empty={empty} pageSize={Math.max(rows.length, 1)} />
      {/* Keyed by case: opening another case mounts a fresh form with THAT case's values.
          Without the key the form kept the previous case's severity and status while its
          hidden case_id changed underneath (K-02). */}
      {openRow && <ClassifyDialog key={openRow.id} row={openRow} onClose={() => setOpenRow(null)} />}
    </>
  );
}

function ClassifyDialog({ row, onClose }: { row: AefiRow; onClose: () => void }) {
  const [state, save] = useActionState<AefiState, FormData>(classifyCaseAction, undefined);
  const [status, setStatus] = useState<Status>(row.status);
  const [severity, setSeverity] = useState<Severity>(row.severity);
  const [reason, setReason] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let live = true;
    severityReasonAction(row.id).then((r) => live && setReason(r));
    return () => {
      live = false;
    };
  }, [row.id]);

  useEffect(() => {
    if (state?.ok) {
      toast("success", state.ok);
      onClose();
    }
  }, [state, toast, onClose]);

  const needsCausality = status === "classified" || status === "closed";
  const downgrade = isSeverityDowngrade(row.severity, severity);
  const field =
    "mt-1 h-10 w-full rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)]";
  const label = "text-sm text-[var(--text-secondary)]";

  return (
    <FormDialog
      title={
        <>
          <span className="font-mono text-base">{row.code}</span> · {row.child_name}
        </>
      }
      onClose={onClose}
    >
      <form action={save} className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            {dateBn(row.onset_date)} · {row.vaccine}
            {row.batch ? ` · ব্যাচ ${row.batch}` : ""} · {row.facility} · রিপোর্ট করেছেন {row.reported_by}
            {row.investigated_by ? ` · তদন্তকারী ${row.investigated_by}` : ""}
          </p>
          <p className="mt-2 rounded-[var(--r-md)] border border-[var(--border-default)] px-3 py-2 text-sm">
            {row.symptoms}
          </p>
          {reason && (
            <p className="mt-2 text-sm text-[var(--warning)]">
              মাত্রা কমানো হয়েছিল — কারণ: {reason}
            </p>
          )}
        </div>

        <input type="hidden" name="case_id" value={row.id} />

        <div className="grid gap-4 sm:grid-cols-3">
          <label className={label}>
            অবস্থা
            <select
              name="status"
              value={status}
              autoFocus
              onChange={(e) => setStatus(e.target.value as Status)}
              className={field}
            >
              {/* Only the moves the database allows: forward, or re-opening a closed case. */}
              {aefiNextStatuses(row.status).map((s) => (
                <option key={s} value={s}>
                  {s === "under_investigation" && row.status === "closed"
                    ? "আবার তদন্তে খুলুন"
                    : AEFI_STATUS_BN[s].label}
                </option>
              ))}
            </select>
          </label>

          <label className={label}>
            মাত্রা
            <select
              name="severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className={field}
            >
              {(Object.keys(AEFI_SEVERITY_BN) as Severity[]).map((s) => (
                <option key={s} value={s}>
                  {AEFI_SEVERITY_BN[s].label} ({AEFI_SEVERITY_HINT_BN[s]})
                </option>
              ))}
            </select>
          </label>

          <label className={label}>
            শিশুর অবস্থা
            <select name="outcome" defaultValue={row.outcome} className={field}>
              {(Object.keys(AEFI_OUTCOME_BN) as Outcome[]).map((o) => (
                <option key={o} value={o}>
                  {AEFI_OUTCOME_BN[o]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {downgrade && (
          <label className={label}>
            মাত্রা কমানোর কারণ <span className="text-[var(--danger)]">*</span>
            <input name="severity_change_reason" required minLength={3} maxLength={300} className={field} />
            <span className="mt-1 block text-xs text-[var(--text-muted)]">
              মাত্রা কমালে ৪৮ ঘণ্টার তদন্ত-সীমার সতর্কতা উঠে যায়, তাই কারণটি সংরক্ষিত থাকে।
            </span>
          </label>
        )}

        <label className={label}>
          কার্যকারণ (WHO শ্রেণিবিন্যাস){" "}
          {needsCausality && <span className="text-[var(--danger)]">*</span>}
          <select name="causality" defaultValue={row.causality ?? ""} required={needsCausality} className={field}>
            <option value="">এখনো নির্ধারিত হয়নি</option>
            {(Object.keys(AEFI_CAUSALITY_BN) as Causality[]).map((c) => (
              <option key={c} value={c}>
                {AEFI_CAUSALITY_BN[c]}
              </option>
            ))}
          </select>
        </label>

        <label className={label}>
          তদন্তের বিবরণ
          <textarea
            name="investigation_note"
            rows={4}
            minLength={3}
            maxLength={2000}
            defaultValue={row.note ?? ""}
            className="mt-1 w-full rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </label>

        <FormMessage error={state?.error} />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            বন্ধ করুন
          </Button>
          <SubmitButton>সংরক্ষণ করুন</SubmitButton>
        </div>
      </form>
    </FormDialog>
  );
}
