"use client";

import { useActionState, useEffect, useState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { dateBn, pctBn, toBn } from "@/lib/format";
import { SESSION_STATE_BN, SESSION_TYPE_BN, type SessionState as RowState } from "@/lib/programme";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormDialog } from "@/components/ui/FormDialog";
import { FormMessage, StatusBadge, SubmitButton } from "@/components/ui/kit";
import { useToast } from "@/components/ui/Toast";
import { cancelSessionAction, type SessionState } from "../_actions";

export type SessionRow = {
  id: string;
  code: string;
  date: string;
  type: Database["public"]["Enums"]["session_type"];
  state: RowState;
  facility: string;
  area: string;
  time: string;
  target: number | null;
  doses: number;
  children: number;
  aefi: number;
  cancel_reason: string | null;
};

// The rows arrive already filtered and paged by the server (see ListControls), so the table
// only renders; the cancel form opens as a dialog over the row it belongs to.
export function SessionsTable({ rows, empty }: { rows: SessionRow[]; empty: string }) {
  const [cancelling, setCancelling] = useState<SessionRow | null>(null);

  const columns: Column<SessionRow>[] = [
    {
      header: "সেশন",
      cell: (r) => (
        <div>
          <span className="font-mono text-xs whitespace-nowrap">{r.code}</span>
          <span className="block text-xs text-[var(--text-muted)]">{SESSION_TYPE_BN[r.type]}</span>
        </div>
      ),
    },
    {
      header: "তারিখ",
      cell: (r) => (
        <div className="whitespace-nowrap">
          {dateBn(r.date)}
          <span className="block text-xs text-[var(--text-muted)]">{r.time}</span>
        </div>
      ),
    },
    { header: "কেন্দ্র", cell: (r) => r.facility },
    { header: "এলাকা", cell: (r) => <span className="text-xs">{r.area}</span> },
    {
      header: "অবস্থা",
      cell: (r) => (
        <StatusBadge tone={SESSION_STATE_BN[r.state].tone}>{SESSION_STATE_BN[r.state].label}</StatusBadge>
      ),
    },
    {
      header: "শিশু / লক্ষ্য",
      align: "right",
      cell: (r) => (
        <span className="whitespace-nowrap">
          {toBn(r.children)}
          {/* UX-07: a session with no planned target shows an em dash, not ০% — "we did not
              set a target" and "we hit none of it" are different failures. */}
          <span className="ml-1 text-xs text-[var(--text-muted)]">
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
          <span className="text-[var(--text-muted)]">{toBn(0)}</span>
        ),
    },
    {
      header: "",
      align: "right",
      cell: (r) =>
        r.state === "upcoming" || r.state === "unreported" ? (
          <span className="print:hidden">
            <Button size="sm" variant="secondary" onClick={() => setCancelling(r)} className="whitespace-nowrap">
              বাতিল করুন
            </Button>
          </span>
        ) : r.cancel_reason ? (
          // The full reason, reachable by keyboard and touch — a `title` tooltip is neither.
          <details className="ml-auto max-w-48 text-left text-xs text-[var(--text-secondary)]">
            <summary className="cursor-pointer truncate">কারণ: {r.cancel_reason}</summary>
            <p className="mt-1 whitespace-normal">{r.cancel_reason}</p>
          </details>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} empty={empty} pageSize={Math.max(rows.length, 1)} />
      {cancelling && (
        <CancelDialog key={cancelling.id} session={cancelling} onDone={() => setCancelling(null)} />
      )}
    </>
  );
}

function CancelDialog({ session, onDone }: { session: SessionRow; onDone: () => void }) {
  const [state, save] = useActionState<SessionState, FormData>(cancelSessionAction, undefined);
  const toast = useToast();

  // Success closes the dialog and says so; the list behind it has already re-rendered with
  // the row as বাতিল. Leaving an armed "সেশন বাতিল করুন" button on screen invited a second click.
  useEffect(() => {
    if (state?.ok) {
      toast("success", state.ok);
      onDone();
    }
  }, [state, toast, onDone]);

  return (
    <FormDialog
      title={
        <>
          সেশন <span className="font-mono">{session.code}</span> বাতিল করুন
        </>
      }
      onClose={onDone}
    >
      <form action={save} className="flex flex-col gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          {dateBn(session.date)} · {session.facility} · {session.area}
        </p>
        <input type="hidden" name="session_id" value={session.id} />
        <label className="text-sm text-[var(--text-secondary)]">
          বাতিলের কারণ
          <input
            name="cancel_reason"
            required
            minLength={3}
            maxLength={300}
            autoFocus
            placeholder="যেমন: টিকা পৌঁছায়নি / বন্যা / কর্মী অনুপস্থিত"
            className="mt-1 h-10 w-full rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)]"
          />
        </label>
        <p className="text-xs text-[var(--text-muted)]">কারণটি বাতিলের প্রতিবেদনে দেখানো হবে। বাতিল করা সেশন আর ফেরানো যায় না।</p>
        <FormMessage error={state?.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onDone}>
            না, সেশন রাখুন
          </Button>
          <SubmitButton variant="danger">সেশন বাতিল করুন</SubmitButton>
        </div>
      </form>
    </FormDialog>
  );
}
