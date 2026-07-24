"use client";

import { useState } from "react";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "right";
};

export type Filter<T> = { label: string; predicate: (row: T) => boolean };

// Client-side substring match over a row's searchable text. Pure so it can be unit-tested
// without React. Case-insensitive; empty query returns everything.
export function filterRows<T>(rows: T[], searchText: (row: T) => string, q: string): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) => searchText(r).toLowerCase().includes(needle));
}

// Shared admin list table: a search box + optional filter chips over already-fetched rows.
// ponytail: client-side filter (no server pagination) — right for the demo dataset; swap to
// Supabase .range() only if a list actually grows past a few hundred rows.
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder,
  filters,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: Filter<T>[];
  empty: string;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);

  let shown = searchText ? filterRows(rows, searchText, q) : rows;
  if (filters && active >= 0) shown = shown.filter(filters[active].predicate);

  return (
    <div className="flex flex-col gap-3">
      {(searchText || filters) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchText && (
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder ?? "খুঁজুন…"}
              aria-label={searchPlaceholder ?? "খুঁজুন"}
              className="w-64 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
          )}
          {filters && (
            <div className="flex flex-wrap gap-1">
              <FilterChip label="সব" on={active === -1} onClick={() => setActive(-1)} />
              {filters.map((f, i) => (
                <FilterChip
                  key={f.label}
                  label={f.label}
                  on={active === i}
                  onClick={() => setActive(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.header}
                  className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={rowKey(row)} className="border-t border-[var(--color-border)]">
                {columns.map((c) => (
                  <td
                    key={c.header}
                    className={`px-4 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-[var(--color-muted)]"
                >
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1 text-xs ${
        on
          ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
          : "border border-[var(--color-border)] text-[var(--color-muted)]"
      }`}
    >
      {label}
    </button>
  );
}
