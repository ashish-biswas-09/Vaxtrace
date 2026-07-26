"use client";

import { useSearchParams } from "next/navigation";

// A plain GET form, not client state.
//
// The whole screen is a function of the URL, so the filters are inputs in a <form method="get">
// and the browser does the navigation. That buys three things for no code: the back button
// steps through filter changes, a filtered view is a shareable link ("look at Kaliakair's
// Penta-3"), and the table still renders with JavaScript disabled. `area` rides along in a
// hidden field so changing the antigen does not throw away the drill-down.
export function CoverageFilters({
  vaccines,
  current,
}: {
  vaccines: { id: string; label: string }[];
  current: { area: string; vaccine: string; year: string; from: string; to: string };
}) {
  // Read from the URL rather than from props for the fields the parent normalises, so the
  // control shows what the user typed even when the server substituted a default.
  const params = useSearchParams();
  const year = Number(current.year);
  const years = [year + 1, year, year - 1, year - 2];

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] p-4 print:hidden"
    >
      <input type="hidden" name="area" value={current.area} />

      <label className="text-xs text-[var(--color-muted)]">
        টিকা
        <select
          name="vaccine"
          defaultValue={current.vaccine}
          className="mt-1 block w-56 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="all" className="text-black">
            সব টিকা (জনসংখ্যা-ভিত্তিক হিসাব ছাড়া)
          </option>
          {vaccines.map((v) => (
            <option key={v.id} value={v.id} className="text-black">
              {v.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[var(--color-muted)]">
        হর-বছর
        <select
          name="year"
          defaultValue={current.year}
          className="mt-1 block w-28 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y} className="text-black">
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[var(--color-muted)]">
        ডোজের সময়কাল — শুরু
        <input
          type="date"
          name="from"
          defaultValue={params.get("from") ?? current.from}
          className="mt-1 block rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <label className="text-xs text-[var(--color-muted)]">
        শেষ
        <input
          type="date"
          name="to"
          defaultValue={params.get("to") ?? current.to}
          className="mt-1 block rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
      >
        প্রয়োগ করুন
      </button>
    </form>
  );
}
