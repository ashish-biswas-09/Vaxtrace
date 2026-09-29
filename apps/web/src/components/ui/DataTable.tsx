"use client";

import { useEffect, useState } from "react";
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
//
// UX-04, the data-density mismatch: the same rows serve a manager on a 1440px display and a
// worker on a five-inch phone, and a media query on a table does not solve that — a table with
// eight columns squeezed into 360px is unreadable however it wraps. So below `md` the rows
// render as cards instead: same data, different component, chosen once here rather than by
// each of the fifteen callers. A caller with a better card for its own data passes `card`.
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder,
  filters,
  empty,
  pageSize = 25,
  card,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: Filter<T>[];
  empty: string;
  pageSize?: number;
  card?: (row: T) => React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const [page, setPage] = useState(0);
  const [printing, setPrinting] = useState(false);

  // A printed list is every row the filter matches, not the page on screen (K-23).
  useEffect(() => {
    const on = () => setPrinting(true);
    const off = () => setPrinting(false);
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    return () => {
      window.removeEventListener("beforeprint", on);
      window.removeEventListener("afterprint", off);
    };
  }, []);

  let shown = searchText ? filterRows(rows, searchText, q) : rows;
  if (filters && active >= 0) shown = shown.filter(filters[active].predicate);

  // Clamp rather than reset-on-change: narrowing a filter while on page 5 should land on the
  // last page that still has rows, not silently show an empty table.
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const paged = printing ? shown : shown.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="flex flex-col gap-3">
      {(searchText || filters) && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
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
              className="w-64 rounded-md border border-[var(--border-default)] bg-transparent px-3 py-2 text-sm"
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

      {/* The card presentation. `md:hidden` / `hidden md:block` rather than a JS breakpoint,
          so the server-rendered HTML is correct at both sizes and neither presentation flashes
          on hydration. */}
      <div className="flex flex-col gap-2 md:hidden">
        {paged.map((row) => (
          <div
            key={rowKey(row)}
            className="rounded-xl border border-[var(--border-default)] p-4 text-sm"
          >
            {card ? (
              card(row)
            ) : (
              <dl className="flex flex-col gap-1.5">
                {columns.map((c, i) => (
                  <div key={c.header} className="flex items-baseline justify-between gap-3">
                    {/* The first column is the row's identity — a name, an ID — so it reads as
                        the card's title rather than as one more label:value pair. */}
                    {i === 0 ? (
                      <dd className="text-base font-medium">{c.cell(row)}</dd>
                    ) : (
                      <>
                        <dt className="shrink-0 text-xs text-[var(--text-muted)]">{c.header}</dt>
                        <dd className="text-right">{c.cell(row)}</dd>
                      </>
                    )}
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border-default)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            {q || active >= 0 ? "এই অনুসন্ধানে কিছু পাওয়া যায়নি।" : empty}
          </p>
        )}
      </div>

      {/* overflow-x-auto, not overflow-hidden: a wide table has to scroll inside its own box
          rather than clipping columns or forcing the whole page sideways on a tablet. */}
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border-default)] md:block">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-[var(--border-default)]/40 text-left text-[var(--text-muted)]">
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
              <tr key={rowKey(row)} className="border-t border-[var(--border-default)]">
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
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
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
        <nav aria-label="পৃষ্ঠা" className="flex items-center justify-between text-xs print:hidden">
          <span className="text-[var(--text-muted)]">
            {toBn(current * pageSize + 1)}–{toBn(current * pageSize + paged.length)} /{" "}
            {toBn(shown.length)}
          </span>
          <div className="flex items-center gap-2">
            <PageButton disabled={current === 0} onClick={() => setPage(current - 1)}>
              ← আগের
            </PageButton>
            <span className="text-[var(--text-muted)]">
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
      className="min-h-9 pointer-coarse:min-h-11 rounded-md border border-[var(--border-default)] px-3 disabled:opacity-40"
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
      className={`min-h-9 pointer-coarse:min-h-11 rounded-full px-3 text-xs ${
        on
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "border border-[var(--border-default)] text-[var(--text-muted)]"
      }`}
    >
      {label}
    </button>
  );
}
