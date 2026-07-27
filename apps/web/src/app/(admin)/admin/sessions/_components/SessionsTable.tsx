"use client";

import { useActionState, useState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { dateBn, pctBn, toBn } from "@/lib/format";
import { SESSION_STATUS_BN, SESSION_TYPE_BN } from "@/lib/programme";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormMessage, StatusBadge, SubmitButton } from "@/components/ui/kit";
import { cancelSessionAction, type SessionState } from "../_actions";

export type SessionRow = {
  id: string;
  code: string;
  date: string;
  type: Database["public"]["Enums"]["session_type"];
  status: Database["public"]["Enums"]["session_status"];
  facility: string;
  area: string;
  time: string;
  target: number | null;
  doses: number;
  children: number;
  voided: number;
  aefi: number;
  cancel_reason: string | null;
};

export function SessionsTable({ rows, today }: { rows: SessionRow[]; today: string }) {
  const [cancelling, setCancelling] = useState<string | null>(null);

  const columns: Column<SessionRow>[] = [
    {
      header: "সেশন",
      cell: (r) => (
        <div>
          <span className="font-mono text-xs">{r.code}</span>
          <span className="block text-xs text-[var(--color-muted)]">
            {SESSION_TYPE_BN[r.type]}
          </span>
        </div>
      ),
    },
    {
      header: "তারিখ",
      cell: (r) => (
        <div>
          {dateBn(r.date)}
          <span className="block text-xs text-[var(--color-muted)]">{r.time}</span>
        </div>
      ),
    },
    { header: "কেন্দ্র", cell: (r) => r.facility },
    { header: "এলাকা", cell: (r) => <span className="text-xs">{r.area}</span> },
    {
      header: "অবস্থা",
      cell: (r) => (
        <StatusBadge tone={SESSION_STATUS_BN[r.status].tone}>
          {SESSION_STATUS_BN[r.status].label}
        </StatusBadge>
      ),
    },
    {
      header: "শিশু / লক্ষ্য",
      align: "right",
      cell: (r) => (
        <span>
          {toBn(r.children)}
          {/* UX-07: a session with no planned target shows an em dash, not ০% — "we did not
              set a target" and "we hit none of it" are different failures. */}
          <span className="ml-1 text-xs text-[var(--color-muted)]">
            / {r.target == null ? "—" : toBn(r.target)}
            {r.target ? ` · ${pctBn(r.children / r.target)}` : ""}
          </span>
        </span>
      ),
    },
    { header: "ডোজ", align: "right", cell: (r) => toBn(r.doses) },
    {
      header: "AEFI",
      align: "right",
      cell: (r) =>
        r.aefi > 0 ? (
          <StatusBadge tone="danger">{toBn(r.aefi)}</StatusBadge>
        ) : (
          <span className="text-[var(--color-muted)]">{toBn(0)}</span>
        ),
    },
    {
      header: "",
      cell: (r) =>
        r.status === "planned" && r.date >= today ? (
          <button
            type="button"
            onClick={() => setCancelling(cancelling === r.id ? null : r.id)}
            aria-expanded={cancelling === r.id}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs print:hidden"
          >
            বাতিল
          </button>
        ) : r.cancel_reason ? (
          <span className="text-xs text-[var(--color-muted)]" title={r.cancel_reason}>
            {r.cancel_reason.slice(0, 24)}
            {r.cancel_reason.length > 24 ? "…" : ""}
          </span>
        ) : null,
    },
  ];

  const active = rows.find((r) => r.id === cancelling) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchText={(r) => `${r.code} ${r.facility} ${r.area}`}
        searchPlaceholder="সেশন কোড, কেন্দ্র বা এলাকা…"
        filters={[
          { label: "আসন্ন", predicate: (r) => r.status === "planned" && r.date >= today },
          { label: "সম্পন্ন", predicate: (r) => r.status === "held" },
          { label: "বাতিল", predicate: (r) => r.status === "cancelled" },
          { label: "আউটরিচ", predicate: (r) => r.type === "outreach" },
        ]}
        empty="এখনো কোনো সেশন পরিকল্পিত হয়নি।"
        pageSize={30}
      />

      {active && <CancelForm session={active} onDone={() => setCancelling(null)} />}
    </div>
  );
}

function CancelForm({ session, onDone }: { session: SessionRow; onDone: () => void }) {
  const [state, save] = useActionState<SessionState, FormData>(cancelSessionAction, undefined);

  return (
    <form
      action={save}
      className="flex flex-col gap-3 rounded-xl border border-[var(--color-warning)] p-5 print:hidden"
    >
      <h2 className="font-medium">
        সেশন <span className="font-mono">{session.code}</span> বাতিল করুন
      </h2>
      <input type="hidden" name="session_id" value={session.id} />
      <label className="text-xs text-[var(--color-muted)]">
        বাতিলের কারণ
        <input
          name="cancel_reason"
          required
          minLength={3}
          maxLength={300}
          placeholder="যেমন: টিকা পৌঁছায়নি / বন্যা / কর্মী অনুপস্থিত"
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-[var(--color-muted)]">
        কারণ অনুযায়ী বাতিলের হারই সেই সংখ্যা, যা দিয়ে আউটরিচের যানবাহন বা অতিরিক্ত কর্মীর দাবি
        প্রমাণ করা যায়।
      </p>
      <FormMessage error={state?.error} ok={state?.ok} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingLabel="বাতিল হচ্ছে…">
          সেশন বাতিল করুন
        </SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
        >
          ফিরে যান
        </button>
      </div>
    </form>
  );
}
