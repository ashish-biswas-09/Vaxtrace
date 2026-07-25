"use client";

import { useState } from "react";
import { fromBn, toBn } from "@/lib/format";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "right";
};

export type Filter<T> = { label: string; predicate: (row: T) => boolean };

// Client-side substring match over a row's searchable text. Pure so it can be unit-tested
// without React. Case-insensitive; empty query returns everything.
//
// Both sides are digit-normalised to ASCII. Numerals render in Bengali everywhere in this
// app, but they are typed in whichever script the keyboard is in — so "১০০০০০০০০৮" and
// "1000000008" have to find the same child. Doing it here means no caller has to remember.
export function filterRows<T>(rows: T[], searchText: (row: T) => string, q: string): T[] {
  const needle = fromBn(q).trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) => fromBn(searchText(r)).toLowerCase().includes(needle));
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
  pageSize = 25,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: Filter<T>[];
  empty: string;
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const [page, setPage] = useState(0);

  let shown = searchText ? filterRows(rows, searchText, q) : rows;
  if (filters && active >= 0) shown = shown.filter(filters[active].predicate);

  // Clamp rather than reset-on-change: narrowing a filter while on page 5 should land on the
  // last page that still has rows, not silently show an empty table.
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const paged = shown.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="flex flex-col gap-3">
      {(searchText || filters) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchText && (
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder ?? "খুঁজুন…"}
              aria-label={searchPlaceholder ?? "খুঁজুন"}
              className="w-64 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
          )}
          {filters && (
            <div className="flex flex-wrap gap-1">
              <FilterChip
                label="সব"
                on={active === -1}
                onClick={() => {
                  setActive(-1);
                  setPage(0);
                }}
              />
              {filters.map((f, i) => (
                <FilterChip
                  key={f.label}
                  label={f.label}
                  on={active === i}
                  onClick={() => {
                    setActive(i);
                    setPage(0);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* overflow-x-auto, not overflow-hidden: a wide table has to scroll inside its own box
          rather than clipping columns or forcing the whole page sideways on a tablet. */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.header}
                  scope="col"
                  className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
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
                  {/* Zero-result is not the same as empty: "no batches exist" and "your
                      search matched nothing" need different next actions. */}
                  {q || active >= 0 ? "এই অনুসন্ধানে কিছু পাওয়া যায়নি।" : empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav aria-label="পৃষ্ঠা" className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted)]">
            {toBn(current * pageSize + 1)}–{toBn(current * pageSize + paged.length)} /{" "}
            {toBn(shown.length)}
          </span>
          <div className="flex items-center gap-2">
            <PageButton disabled={current === 0} onClick={() => setPage(current - 1)}>
              ← আগের
            </PageButton>
            <span className="text-[var(--color-muted)]">
              {toBn(current + 1)} / {toBn(pageCount)}
            </span>
            <PageButton disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
              পরের →
            </PageButton>
          </div>
        </nav>
      )}
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40"
    >
      {children}
    </button>
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
