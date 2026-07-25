"use client";

import { DataTable, type Column, type Filter } from "../../_components/DataTable";
import { RoleSelect } from "./RoleSelect";
import { StatusSelect } from "./StatusSelect";
import { USER_STATUS } from "../_status";

export type UserRow = {
  id: string;
  full_name: string;
  contact: string | null;
  role: string;
  status: string;
  staff_code: string | null;
  is_self: boolean;
};

const ROLE_BN: Record<string, string> = {
  admin: "অ্যাডমিন",
  worker: "স্বাস্থ্যকর্মী",
  parent: "অভিভাবক",
};

const columns: Column<UserRow>[] = [
  {
    // The staff code is the identifier a user is referenced by in reports and audit trails,
    // so it belongs in the first column rather than hidden on a detail screen.
    header: "আইডি",
    cell: (u) => (
      <span className="font-mono text-xs tracking-wide">{u.staff_code ?? "—"}</span>
    ),
  },
  {
    header: "নাম",
    cell: (u) => (
      <>
        {u.full_name}
        {u.is_self && <span className="ml-2 text-xs text-[var(--color-muted)]">(আপনি)</span>}
      </>
    ),
  },
  {
    header: "যোগাযোগ",
    cell: (u) => <span className="text-[var(--color-muted)]">{u.contact ?? "—"}</span>,
  },
  {
    header: "ভূমিকা",
    cell: (u) => <RoleSelect userId={u.id} currentRole={u.role} disabled={u.is_self} />,
  },
  {
    header: "অবস্থা",
    cell: (u) => <StatusSelect userId={u.id} currentStatus={u.status} disabled={u.is_self} />,
  },
];

const filters: Filter<UserRow>[] = [
  { label: ROLE_BN.admin, predicate: (u) => u.role === "admin" },
  { label: ROLE_BN.worker, predicate: (u) => u.role === "worker" },
  { label: ROLE_BN.parent, predicate: (u) => u.role === "parent" },
  { label: USER_STATUS.invited.label, predicate: (u) => u.status === "invited" },
  { label: USER_STATUS.inactive.label, predicate: (u) => u.status === "inactive" },
];

export function UsersTable({ rows }: { rows: UserRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(u) => u.id}
      searchText={(u) => `${u.staff_code ?? ""} ${u.full_name} ${u.contact ?? ""}`}
      searchPlaceholder="আইডি, নাম বা যোগাযোগ খুঁজুন…"
      filters={filters}
      empty="কোনো ব্যবহারকারী নেই।"
    />
  );
}
