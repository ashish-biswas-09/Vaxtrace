import Link from "next/link";
import { toBn } from "@/lib/format";

// Search, filter chips and pagination for a list the SERVER pages (K-19). Everything lives in
// the URL, so a filtered page is shareable, survives a reload and the back button steps
// through it — and nothing here needs client JavaScript.
//
// `sanitizeSearch` exists because PostgREST's `or=` is a comma-separated grammar with `.`, `(`,
// `)` and `*` as operators: raw input could rewrite the filter.

export const PAGE_SIZE = 30;

export function sanitizeSearch(q: string | undefined): string {
  return (q ?? "").replace(/[^\p{L}\p{N}\p{M}\s-]/gu, "").trim().slice(0, 60);
}

export function pageOf(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n - 1 : 0;
}

type Params = Record<string, string | undefined>;

export function hrefWith(base: string, params: Params, over: Params): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...over })) if (v) q.set(k, v);
  return `${base}${q.size ? `?${q}` : ""}`;
}

export function ListControls({
  base,
  params,
  chips,
  searchPlaceholder,
}: {
  base: string;
  params: Params;
  chips: { value: string; label: string; count?: number }[];
  searchPlaceholder: string;
}) {
  const active = params.filter ?? "";
  const chip = (value: string, label: string, count?: number) => {
    const on = active === value;
    return (
      <Link
        key={value || "all"}
        href={hrefWith(base, params, { filter: value || undefined, page: undefined })}
        aria-current={on ? "true" : undefined}
        className={`inline-flex min-h-9 pointer-coarse:min-h-11 items-center rounded-full px-3 text-xs ${
          on
            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
            : "border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
        }`}
      >
        {label}
        {count != null && <span className="ml-1 tabular-nums">({toBn(count)})</span>}
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <form method="get" action={base} role="search" className="flex gap-2">
        {params.filter && <input type="hidden" name="filter" value={params.filter} />}
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-64 rounded-[var(--r-md)] border border-[var(--border-default)] bg-[var(--surface)] px-3 text-sm"
        />
      </form>
      <nav aria-label="ফিল্টার" className="flex flex-wrap gap-1">
        {chip("", "সব")}
        {chips.map((c) => chip(c.value, c.label, c.count))}
      </nav>
    </div>
  );
}

export function Pager({
  base,
  params,
  page,
  total,
}: {
  base: string;
  params: Params;
  page: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pageCount <= 1 || params.all) return null;
  const btn =
    "inline-flex min-h-9 pointer-coarse:min-h-11 items-center rounded-[var(--r-md)] border border-[var(--border-default)] px-3";
  return (
    <nav aria-label="পৃষ্ঠা" className="flex items-center justify-between text-xs print:hidden">
      <span className="text-[var(--text-muted)]">
        {toBn(page * PAGE_SIZE + 1)}–{toBn(Math.min(total, (page + 1) * PAGE_SIZE))} / {toBn(total)}
      </span>
      <div className="flex items-center gap-2">
        {page > 0 ? (
          <Link className={btn} href={hrefWith(base, params, { page: page > 1 ? String(page) : undefined })}>
            ← আগের
          </Link>
        ) : (
          <button type="button" disabled className={`${btn} opacity-40`}>← আগের</button>
        )}
        <span className="text-[var(--text-muted)]">
          {toBn(page + 1)} / {toBn(pageCount)}
        </span>
        {page < pageCount - 1 ? (
          <Link className={btn} href={hrefWith(base, params, { page: String(page + 2) })}>
            পরের →
          </Link>
        ) : (
          <button type="button" disabled className={`${btn} opacity-40`}>পরের →</button>
        )}
      </div>
    </nav>
  );
}
