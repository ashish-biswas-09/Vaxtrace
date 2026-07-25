"use client";

import { toBn } from "@/lib/format";
import { hasUsablePhone } from "@/lib/guardians";
import { StatusBadge } from "../../_components/ui";
import { DataTable, type Column, type Filter } from "../../_components/DataTable";

export type GuardianRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  relationship: string;
  claimed: boolean;
  children: number;
  created_at: string;
};

const columns: Column<GuardianRow>[] = [
  { header: "নাম", cell: (g) => g.full_name },
  { header: "সম্পর্ক", cell: (g) => <span className="text-[var(--color-muted)]">{g.relationship}</span> },
  {
    header: "ফোন",
    cell: (g) =>
      hasUsablePhone(g.phone) ? (
        <span className="font-mono text-xs">{g.phone}</span>
      ) : (
        <StatusBadge tone="danger">নেই</StatusBadge>
      ),
  },
  {
    header: "ইমেইল",
    cell: (g) => (
      <span className="text-xs text-[var(--color-muted)]">{g.email ?? "—"}</span>
    ),
  },
  { header: "শিশু", cell: (g) => toBn(g.children) },
  {
    header: "অ্যাকাউন্ট",
    cell: (g) =>
      g.claimed ? (
        <StatusBadge tone="success">যুক্ত</StatusBadge>
      ) : (
        // Not an error state: registering a child never required an account, and most
        // guardians will never create one.
        <StatusBadge tone="muted">যুক্ত হয়নি</StatusBadge>
      ),
  },
  {
    header: "যোগ হয়েছে",
    cell: (g) => <span className="text-[var(--color-muted)]">{g.created_at}</span>,
  },
];

const filters: Filter<GuardianRow>[] = [
  { label: "নম্বর নেই", predicate: (g) => !hasUsablePhone(g.phone) },
  { label: "অ্যাকাউন্ট যুক্ত হয়নি", predicate: (g) => !g.claimed },
  { label: "একাধিক শিশু", predicate: (g) => g.children > 1 },
];

export function GuardiansTable({ rows }: { rows: GuardianRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(g) => g.id}
      searchText={(g) => `${g.full_name} ${g.phone} ${g.email ?? ""}`}
      searchPlaceholder="নাম, ফোন বা ইমেইল খুঁজুন…"
      filters={filters}
      empty="কোনো অভিভাবক নেই।"
    />
  );
}
