"use client";

import { dateBn, toBn } from "@/lib/format";
import { StatusBadge } from "../../_components/ui";
import { DataTable, type Column, type Filter } from "../../_components/DataTable";
import { NOTIF_CHANNEL, NOTIF_STATUS, notifStatus } from "../status";

export type NotifRow = {
  id: string;
  recipient_name: string;
  channel: string;
  status: string;
  attempts: number;
  scheduled_for: string;
  sent_at: string | null;
  last_error: string | null;
};

const columns: Column<NotifRow>[] = [
  { header: "প্রাপক", cell: (n) => n.recipient_name },
  {
    header: "চ্যানেল",
    cell: (n) => <StatusBadge tone="muted">{NOTIF_CHANNEL[n.channel] ?? n.channel}</StatusBadge>,
  },
  {
    header: "নির্ধারিত সময়",
    cell: (n) => <span className="text-[var(--color-muted)]">{dateBn(n.scheduled_for)}</span>,
  },
  {
    header: "অবস্থা",
    cell: (n) => {
      const st = notifStatus(n.status);
      return (
        <>
          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          {/* A failure with no reason attached is not actionable — surface last_error where
              the operator is already looking. */}
          {n.last_error && (
            <div className="mt-1 max-w-xs truncate text-xs text-[var(--color-danger)]" title={n.last_error}>
              {n.last_error}
            </div>
          )}
        </>
      );
    },
  },
  { header: "চেষ্টা", cell: (n) => toBn(n.attempts), align: "right" },
  {
    header: "পাঠানো",
    cell: (n) => <span className="text-[var(--color-muted)]">{dateBn(n.sent_at)}</span>,
  },
];

const filters: Filter<NotifRow>[] = Object.entries(NOTIF_STATUS).map(([key, { label }]) => ({
  label,
  predicate: (n: NotifRow) => n.status === key,
}));

export function NotificationsTable({ rows }: { rows: NotifRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(n) => n.id}
      searchText={(n) => `${n.recipient_name} ${n.channel} ${n.last_error ?? ""}`}
      searchPlaceholder="প্রাপক বা ত্রুটি খুঁজুন…"
      filters={filters}
      empty="কোনো বিজ্ঞপ্তি নেই।"
    />
  );
}
