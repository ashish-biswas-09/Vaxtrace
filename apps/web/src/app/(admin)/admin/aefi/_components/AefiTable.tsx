"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { dateBn } from "@/lib/format";
import {
  AEFI_CAUSALITY_BN,
  AEFI_OUTCOME_BN,
  AEFI_SEVERITY_BN,
  AEFI_STATUS_BN,
} from "@/lib/programme";
import { DataTable, type Column } from "../../_components/DataTable";
import { FormMessage, StatusBadge, SubmitButton } from "../../_components/ui";
import { classifyCaseAction, type AefiState } from "../_actions";

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

export function AefiTable({ rows }: { rows: AefiRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const columns: Column<AefiRow>[] = [
    {
      header: "কেস",
      cell: (r) => (
        <div>
          <span className="font-mono text-xs">{r.code}</span>
          <span className="block text-xs text-[var(--color-muted)]">{dateBn(r.onset_date)}</span>
        </div>
      ),
    },
    {
      header: "শিশু",
      cell: (r) => (
        <Link href={`/admin/children/${r.child_id}`} className="text-[var(--color-primary)]">
          {r.child_name}
        </Link>
      ),
    },
    {
      header: "মাত্রা",
      cell: (r) => (
        <StatusBadge tone={AEFI_SEVERITY_BN[r.severity].tone}>
          {AEFI_SEVERITY_BN[r.severity].label}
        </StatusBadge>
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
    { header: "উপসর্গ", cell: (r) => <span className="text-xs">{r.symptoms.slice(0, 60)}</span> },
    { header: "টিকা", cell: (r) => <span className="text-xs">{r.vaccine}</span> },
    {
      header: "ব্যাচ",
      // The recall link. "Which children reacted to BCG-2211" is the question asked at three
      // in the morning, and this column is the only reason it is answerable.
      cell: (r) =>
        r.batch ? <span className="font-mono text-xs">{r.batch}</span> : <span>—</span>,
    },
    {
      header: "কার্যকারণ",
      cell: (r) =>
        r.causality ? (
          <span className="text-xs">{AEFI_CAUSALITY_BN[r.causality]}</span>
        ) : (
          <button
            type="button"
            onClick={() => setOpenId(openId === r.id ? null : r.id)}
            aria-expanded={openId === r.id}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
          >
            তদন্ত / শ্রেণিবিন্যাস
          </button>
        ),
    },
  ];

  const active = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) =>
          `${r.code} ${r.child_name} ${r.child_code} ${r.symptoms} ${r.vaccine} ${r.batch ?? ""} ${r.area}`
        }
        searchPlaceholder="কেস, শিশু, উপসর্গ বা ব্যাচ…"
        filters={[
          { label: "মারাত্মক", predicate: (r) => r.severity === "serious" },
          { label: "বিলম্বিত", predicate: (r) => r.overdue },
          {
            label: "খোলা",
            predicate: (r) => r.status === "reported" || r.status === "under_investigation",
          },
          { label: "শ্রেণিবদ্ধ", predicate: (r) => r.causality != null },
        ]}
        empty="কোনো কেস নেই।"
        pageSize={30}
      />

      {active && <ClassifyPanel row={active} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ClassifyPanel({ row, onClose }: { row: AefiRow; onClose: () => void }) {
  const [state, save] = useActionState<AefiState, FormData>(classifyCaseAction, undefined);
  const [status, setStatus] = useState<Status>(row.status);

  const needsCausality = status === "classified" || status === "closed";

  return (
    <form action={save} className="flex flex-col gap-4 rounded-xl border border-[var(--color-primary)] p-5">
      <div>
        <h2 className="text-lg font-medium">
          <span className="font-mono text-sm">{row.code}</span> · {row.child_name}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {dateBn(row.onset_date)} · {row.vaccine}
          {row.batch ? ` · ব্যাচ ${row.batch}` : ""} · {row.facility} · রিপোর্ট করেছেন{" "}
          {row.reported_by}
        </p>
        <p className="mt-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
          {row.symptoms}
        </p>
      </div>

      <input type="hidden" name="case_id" value={row.id} />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-[var(--color-muted)]">
          অবস্থা
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {(Object.keys(AEFI_STATUS_BN) as Status[]).map((s) => (
              <option key={s} value={s} className="text-black">
                {AEFI_STATUS_BN[s].label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          মাত্রা
          <select
            name="severity"
            defaultValue={row.severity}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {(Object.keys(AEFI_SEVERITY_BN) as Severity[]).map((s) => (
              <option key={s} value={s} className="text-black">
                {AEFI_SEVERITY_BN[s].label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          শিশুর অবস্থা
          <select
            name="outcome"
            defaultValue={row.outcome}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {(Object.keys(AEFI_OUTCOME_BN) as Outcome[]).map((o) => (
              <option key={o} value={o} className="text-black">
                {AEFI_OUTCOME_BN[o]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-xs text-[var(--color-muted)]">
        কার্যকারণ (WHO শ্রেণিবিন্যাস){" "}
        {needsCausality && <span className="text-[var(--color-danger)]">*</span>}
        <select
          name="causality"
          defaultValue={row.causality ?? ""}
          required={needsCausality}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="" className="text-black">
            এখনো নির্ধারিত হয়নি
          </option>
          {(Object.keys(AEFI_CAUSALITY_BN) as Causality[]).map((c) => (
            <option key={c} value={c} className="text-black">
              {AEFI_CAUSALITY_BN[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[var(--color-muted)]">
        তদন্তের বিবরণ
        <textarea
          name="investigation_note"
          rows={4}
          maxLength={2000}
          defaultValue={row.note ?? ""}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <FormMessage error={state?.error} ok={state?.ok} />

      <div className="flex gap-2">
        <SubmitButton pendingLabel="সংরক্ষণ হচ্ছে…">সংরক্ষণ করুন</SubmitButton>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
        >
          বন্ধ করুন
        </button>
      </div>
    </form>
  );
}
