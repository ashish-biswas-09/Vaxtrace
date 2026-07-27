"use client";

import Link from "next/link";
import { toBn, dateBn } from "@/lib/format";
import { StatusBadge } from "@/components/ui/kit";
import { DataTable, type Column, type Filter } from "@/components/ui/DataTable";
import type { BatchTone } from "../status";

export type BatchRow = {
  id: string;
  vaccine_name: string;
  batch_number: string;
  stock_quantity: number;
  expiry_date: string;
  tone: BatchTone;
  label: string;
};

const columns: Column<BatchRow>[] = [
  { header: "টিকা", cell: (b) => b.vaccine_name },
  { header: "ব্যাচ", cell: (b) => <span className="font-mono text-xs">{b.batch_number}</span> },
  { header: "মজুদ", cell: (b) => toBn(b.stock_quantity), align: "right" },
  {
    header: "মেয়াদ",
    cell: (b) => <span className="text-[var(--color-muted)]">{dateBn(b.expiry_date)}</span>,
  },
  { header: "অবস্থা", cell: (b) => <StatusBadge tone={b.tone}>{b.label}</StatusBadge> },
  {
    header: "",
    align: "right",
    cell: (b) => (
      <Link
        href={`/admin/inventory/${b.id}`}
        className="text-[var(--color-primary)] hover:underline"
      >
        সম্পাদনা
      </Link>
    ),
  },
];

// Isolates the rows an admin acts on (audit gap: no way to filter low/expiring).
const filters: Filter<BatchRow>[] = [
  { label: "মনোযোগ প্রয়োজন", predicate: (b) => b.tone !== "success" },
];

export function InventoryTable({ rows }: { rows: BatchRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(b) => b.id}
      searchText={(b) => `${b.vaccine_name} ${b.batch_number}`}
      searchPlaceholder="টিকা বা ব্যাচ খুঁজুন…"
      filters={filters}
      empty="কোনো ব্যাচ নেই।"
    />
  );
}
