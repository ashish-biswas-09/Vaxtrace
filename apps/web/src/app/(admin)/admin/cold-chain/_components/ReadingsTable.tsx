"use client";

import { dateTimeBn } from "@/lib/format";
import { DataTable, type Column } from "../../_components/DataTable";
import { StatusBadge } from "../../_components/ui";

export type ReadingRow = {
  id: string;
  at: string;
  temperature: number;
  device: string;
  facility: string;
  is_excursion: boolean;
  range: string;
  action: string | null;
};

const columns: Column<ReadingRow>[] = [
  { header: "সময়", cell: (r) => <span className="text-xs">{dateTimeBn(r.at)}</span> },
  { header: "কেন্দ্র", cell: (r) => <span className="text-xs">{r.facility}</span> },
  { header: "যন্ত্র", cell: (r) => r.device },
  {
    header: "তাপমাত্রা",
    align: "right",
    cell: (r) => (
      <StatusBadge tone={r.is_excursion ? "danger" : "success"}>
        {r.temperature} °C{r.is_excursion ? " · সীমার বাইরে" : ""}
      </StatusBadge>
    ),
  },
  { header: "নির্ধারিত সীমা", cell: (r) => <span className="text-xs tabular-nums">{r.range}</span> },
  {
    header: "ব্যবস্থা",
    cell: (r) => <span className="text-xs text-[var(--color-muted)]">{r.action ?? "—"}</span>,
  },
];

export function ReadingsTable({ rows }: { rows: ReadingRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) => `${r.device} ${r.facility} ${r.action ?? ""}`}
      searchPlaceholder="যন্ত্র বা কেন্দ্র…"
      filters={[{ label: "সীমার বাইরে", predicate: (r) => r.is_excursion }]}
      empty="এখনো কোনো তাপমাত্রা নথিভুক্ত হয়নি।"
      pageSize={40}
    />
  );
}
