"use client";

import type { Database } from "@vaxtrace/db-types";
import { dateBn, dateTimeBn, toBn } from "@/lib/format";
import { STOCK_TXN_BN, WASTAGE_REASON_BN } from "@/lib/programme";
import { DataTable, type Column } from "../../_components/DataTable";
import { StatusBadge } from "../../_components/ui";

export type LedgerRow = {
  id: string;
  at: string;
  type: Database["public"]["Enums"]["stock_txn_type"];
  quantity: number;
  reason: Database["public"]["Enums"]["wastage_reason"] | null;
  note: string | null;
  batch: string;
  expiry: string | null;
  balance: number;
  vaccine: string;
  facility: string;
  counterparty: string | null;
  by: string;
};

const columns: Column<LedgerRow>[] = [
  { header: "সময়", cell: (r) => <span className="text-xs">{dateTimeBn(r.at)}</span> },
  {
    header: "ধরন",
    cell: (r) => (
      <div>
        <StatusBadge tone={STOCK_TXN_BN[r.type].tone}>{STOCK_TXN_BN[r.type].label}</StatusBadge>
        {r.reason && (
          <span className="block text-[11px] text-[var(--color-muted)]">
            {WASTAGE_REASON_BN[r.reason]}
          </span>
        )}
      </div>
    ),
  },
  { header: "টিকা", cell: (r) => <span className="text-xs">{r.vaccine}</span> },
  {
    header: "ব্যাচ",
    cell: (r) => (
      <div>
        <span className="font-mono text-xs">{r.batch}</span>
        {r.expiry && (
          <span className="block text-[11px] text-[var(--color-muted)]">
            মেয়াদ {dateBn(r.expiry)}
          </span>
        )}
      </div>
    ),
  },
  {
    header: "পরিমাণ",
    align: "right",
    // The sign is the whole point of a ledger, so it is shown, not hidden behind a label.
    cell: (r) => (
      <span
        className="font-medium tabular-nums"
        style={{ color: r.quantity < 0 ? "var(--color-danger)" : "var(--color-success)" }}
      >
        {r.quantity > 0 ? "+" : "−"}
        {toBn(Math.abs(r.quantity))}
      </span>
    ),
  },
  { header: "ব্যাচের মজুদ", align: "right", cell: (r) => toBn(r.balance) },
  {
    header: "কেন্দ্র",
    cell: (r) => (
      <div className="text-xs">
        {r.facility}
        {r.counterparty && (
          <span className="block text-[var(--color-muted)]">↔ {r.counterparty}</span>
        )}
      </div>
    ),
  },
  { header: "কে", cell: (r) => <span className="text-xs">{r.by}</span> },
  {
    header: "মন্তব্য",
    cell: (r) => <span className="text-xs text-[var(--color-muted)]">{r.note ?? "—"}</span>,
  },
];

export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) => `${r.batch} ${r.vaccine} ${r.facility} ${r.by} ${r.note ?? ""}`}
      searchPlaceholder="ব্যাচ, টিকা, কেন্দ্র বা কর্মী…"
      filters={[
        { label: "অপচয়", predicate: (r) => r.type === "wastage" },
        { label: "সমন্বয়", predicate: (r) => r.type === "adjustment" },
        { label: "গ্রহণ", predicate: (r) => r.type === "receipt" },
        { label: "স্থানান্তর", predicate: (r) => r.type.startsWith("transfer") },
      ]}
      empty="লেজারে এখনো কোনো লেনদেন নেই।"
      pageSize={40}
    />
  );
}
