"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/kit";

export type ZeroDoseRow = {
  child_id: string;
  child_code: string;
  full_name: string;
  age: string;
  age_days: number;
  area: string;
  guardian_name: string;
  guardian_phone: string;
  address: string;
  due_date: string;
};

const columns: Column<ZeroDoseRow>[] = [
  {
    header: "শিশু",
    cell: (r) => (
      <Link href={`/admin/children/${r.child_id}`} className="text-[var(--accent)]">
        {r.full_name}
      </Link>
    ),
  },
  { header: "শিশু আইডি", cell: (r) => <span className="font-mono text-xs">{r.child_code}</span> },
  {
    header: "বয়স",
    cell: (r) => (
      // Six months is the line at which a zero-dose child stops being late and starts being
      // likely to never begin. The badge carries a text label, never colour alone (§16.5).
      <StatusBadge tone={r.age_days >= 180 ? "danger" : "warning"}>
        {r.age}
        {r.age_days >= 180 ? " · জরুরি" : ""}
      </StatusBadge>
    ),
  },
  { header: "প্রথম ডোজের তারিখ ছিল", cell: (r) => r.due_date },
  { header: "এলাকা", cell: (r) => <span className="text-xs">{r.area}</span> },
  { header: "অভিভাবক", cell: (r) => r.guardian_name },
  {
    header: "ফোন",
    cell: (r) => (
      // tel: because this list is used with a phone in the other hand.
      <a href={`tel:${r.guardian_phone}`} className="font-mono text-xs">
        {r.guardian_phone}
      </a>
    ),
  },
  { header: "ঠিকানা", cell: (r) => <span className="text-xs">{r.address}</span> },
];

export function ZeroDoseTable({ rows }: { rows: ZeroDoseRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.child_id}
      searchText={(r) => `${r.full_name} ${r.child_code} ${r.guardian_name} ${r.guardian_phone} ${r.area}`}
      searchPlaceholder="নাম, আইডি, ফোন বা এলাকা…"
      filters={[
        { label: "৬ মাসের বেশি", predicate: (r) => r.age_days >= 180 },
        { label: "৬ মাসের কম", predicate: (r) => r.age_days < 180 },
      ]}
      empty="কোনো শূন্য-ডোজ শিশু নেই।"
      pageSize={50}
    />
  );
}
