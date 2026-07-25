"use client";

import Link from "next/link";
import { toBn } from "@/lib/format";
import { StatusBadge } from "../../_components/ui";
import { DataTable, type Column, type Filter } from "../../_components/DataTable";

export type VaccineRow = {
  id: string;
  code: string;
  name_bn: string;
  name_en: string;
  total_doses: number;
  is_active: boolean;
  doses_defined: number;
};

const columns: Column<VaccineRow>[] = [
  { header: "কোড", cell: (v) => <span className="font-mono text-xs">{v.code}</span> },
  {
    header: "নাম",
    cell: (v) => (
      <>
        <Link href={`/admin/catalog/${v.id}`} className="hover:underline">
          {v.name_bn}
        </Link>
        <span className="ml-2 text-xs text-[var(--color-muted)]">{v.name_en}</span>
      </>
    ),
  },
  { header: "ডোজ", cell: (v) => toBn(v.total_doses), align: "right" },
  {
    // total_doses is a declaration; vaccine_doses rows are what actually generate a child's
    // schedule. When they disagree, children silently get an incomplete calendar — so the
    // mismatch is surfaced here rather than discovered from a coverage report months later.
    header: "সূচি সংজ্ঞায়িত",
    align: "right",
    cell: (v) =>
      v.doses_defined === v.total_doses ? (
        <span className="tabular-nums text-[var(--color-muted)]">{toBn(v.doses_defined)}</span>
      ) : (
        <StatusBadge tone="warning">
          {toBn(v.doses_defined)} / {toBn(v.total_doses)}
        </StatusBadge>
      ),
  },
  {
    header: "অবস্থা",
    cell: (v) => (
      <StatusBadge tone={v.is_active ? "success" : "muted"}>
        {v.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
      </StatusBadge>
    ),
  },
  {
    header: "",
    align: "right",
    cell: (v) => (
      <Link href={`/admin/catalog/${v.id}`} className="text-[var(--color-primary)] hover:underline">
        সম্পাদনা
      </Link>
    ),
  },
];

const filters: Filter<VaccineRow>[] = [
  { label: "সক্রিয়", predicate: (v) => v.is_active },
  { label: "নিষ্ক্রিয়", predicate: (v) => !v.is_active },
  { label: "সূচি অসম্পূর্ণ", predicate: (v) => v.doses_defined !== v.total_doses },
];

export function CatalogTable({ rows }: { rows: VaccineRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(v) => v.id}
      searchText={(v) => `${v.code} ${v.name_bn} ${v.name_en}`}
      searchPlaceholder="কোড বা টিকার নাম খুঁজুন…"
      filters={filters}
      empty="কোনো টিকা নেই।"
    />
  );
}
