"use client";

import Link from "next/link";
import { ageBn, dateBn, pctBn, toBn } from "@/lib/format";
import { StatusBadge } from "../../_components/ui";
import { DataTable, type Column } from "../../_components/DataTable";

const GENDER_BN: Record<string, string> = { male: "ছেলে", female: "মেয়ে", other: "অন্যান্য" };

export type ChildRow = {
  id: string;
  child_id: string;
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
    header: "শিশু আইডি",
    cell: (k) => <span className="font-mono tracking-wide">{toBn(k.child_id)}</span>,
  },
  {
    header: "শিশু",
    cell: (k) => (
      <>
        <Link href={`/admin/children/${k.id}`} className="font-medium hover:underline">
          {k.full_name}
        </Link>
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
  {
    header: "",
    cell: (k) => (
      <Link href={`/admin/children/${k.id}`} className="text-[var(--color-primary)] hover:underline">
        ইতিহাস দেখুন
      </Link>
    ),
  },
];

export function ChildrenTable({ rows }: { rows: ChildRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(k) => k.id}
      // Child ID stays ASCII here; DataTable normalises Bengali digits in the query, so a
      // card read aloud in Bangla and one scanned in Latin both hit the same row.
      searchText={(k) =>
        `${k.child_id} ${k.full_name} ${k.guardian_name ?? ""} ${k.guardian_contact ?? ""}`
      }
      searchPlaceholder="শিশু আইডি, নাম বা অভিভাবক খুঁজুন…"
      filters={[
        { label: "কভারেজ < ৫০%", predicate: (k) => k.coverage != null && k.coverage < 0.5 },
        { label: "সূচি শুরু হয়নি", predicate: (k) => k.coverage == null },
      ]}
      empty="কোনো শিশু নিবন্ধিত নেই।"
    />
  );
}
