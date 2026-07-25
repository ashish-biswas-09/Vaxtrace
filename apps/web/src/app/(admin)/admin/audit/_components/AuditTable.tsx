"use client";

import { dateBn } from "@/lib/format";
import { StatusBadge } from "../../_components/ui";
import { auditLabel } from "../../_audit";
import { DataTable, type Column, type Filter } from "../../_components/DataTable";

export type AuditRow = {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  at: string;
  actor_name: string;
};

const columns: Column<AuditRow>[] = [
  {
    header: "সময়",
    cell: (r) => <span className="text-[var(--color-muted)]">{dateBn(r.at)}</span>,
  },
  { header: "ব্যবহারকারী", cell: (r) => r.actor_name },
  { header: "কাজ", cell: (r) => <StatusBadge tone="muted">{auditLabel(r.action)}</StatusBadge> },
  {
    header: "এন্টিটি",
    cell: (r) => (
      <span className="font-mono text-xs text-[var(--color-muted)]">
        {r.entity}
        {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
      </span>
    ),
  },
];

// Filters by entity, not by exact action string: the trigger emits "<table>.<op>", so one
// chip per subject area covers insert/update/delete instead of three chips each. Labels are
// derived through auditLabel rather than written out again, so adding a new audited table
// means touching one map and nothing here.
const ENTITIES = [
  "children",
  "vaccination_records",
  "inventories",
  "user_roles",
  "vaccines",
  "profiles",
];

const filters: Filter<AuditRow>[] = ENTITIES.map((entity) => ({
  label: auditLabel(entity),
  predicate: (r: AuditRow) =>
    entity === "vaccines" ? r.entity.startsWith("vaccine") : r.entity === entity,
}));

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => String(r.id)}
      searchText={(r) => `${r.actor_name} ${r.entity} ${r.entity_id ?? ""} ${auditLabel(r.action)}`}
      searchPlaceholder="ব্যবহারকারী, কাজ বা এন্টিটি খুঁজুন…"
      filters={filters}
      empty="কোনো কার্যক্রম নেই।"
    />
  );
}
