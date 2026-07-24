"use client";

import { ageBn, dateBn, pctBn } from "@/lib/format";
import { StatusBadge } from "../../_components/ui";
import { DataTable, type Column } from "../../_components/DataTable";

const GENDER_BN: Record<string, string> = { male: "ছেলে", female: "মেয়ে", other: "অন্যান্য" };

export type ChildRow = {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  guardian_name: string | null;
  guardian_contact: string | null;
  created_at: string;
  coverage: number | null;
};

function covTone(rate: number | null) {
  return rate == null ? "muted" : rate >= 0.8 ? "success" : rate >= 0.5 ? "warning" : "danger";
}

const columns: Column<ChildRow>[] = [
  {
    header: "শিশু",
    cell: (k) => (
      <>
        <div className="font-medium">{k.full_name}</div>
        <div className="text-xs text-[var(--color-muted)]">
          {ageBn(k.date_of_birth)} · {GENDER_BN[k.gender] ?? k.gender}
        </div>
      </>
    ),
  },
  { header: "অভিভাবক", cell: (k) => k.guardian_name ?? "—" },
  {
    header: "যোগাযোগ",
    cell: (k) => <span className="text-[var(--color-muted)]">{k.guardian_contact ?? "—"}</span>,
  },
  {
    header: "টিকা কভারেজ",
    cell: (k) => <StatusBadge tone={covTone(k.coverage)}>{pctBn(k.coverage)}</StatusBadge>,
  },
  {
    header: "নিবন্ধিত",
    cell: (k) => <span className="text-[var(--color-muted)]">{dateBn(k.created_at)}</span>,
  },
];

export function ChildrenTable({ rows }: { rows: ChildRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(k) => k.id}
      searchText={(k) => `${k.full_name} ${k.guardian_name ?? ""} ${k.guardian_contact ?? ""}`}
      searchPlaceholder="নাম বা অভিভাবক খুঁজুন…"
      empty="কোনো শিশু নিবন্ধিত নেই।"
    />
  );
}
