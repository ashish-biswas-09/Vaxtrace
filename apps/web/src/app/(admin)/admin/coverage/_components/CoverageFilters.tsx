"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dateBn, toBn } from "@/lib/format";

// A plain GET form, not client state.
//
// The whole screen is a function of the URL, so the filters are inputs in a <form method="get">
// and the browser does the navigation. That buys three things for no code: the back button
// steps through filter changes, a filtered view is a shareable link ("look at Kaliakair's
// Penta-3"), and the table still renders with JavaScript disabled. `area` rides along in a
// hidden field so changing the antigen does not throw away the drill-down.
//
// The server has already validated every value it passes in (lib/coverageParams.ts), so the
// controls show what the query actually used.
export function CoverageFilters({
  vaccines,
  years,
  current,
}: {
  vaccines: { id: string; label: string }[];
  years: number[];
  current: { area: string; vaccine: string; year: string; from: string; to: string };
}) {
  // `from` sets the earliest date the `to` picker will accept, so a reversed range cannot be
  // entered in the first place; both echo the chosen date in Bengali under the native picker,
  // whose own format follows the browser's locale (mm/dd/yyyy).
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);
  const control =
    "h-10 rounded-[var(--r-md)] border border-[var(--border-default)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)]";

  return (
    <form
      method="get"
      className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-4 print:hidden"
    >
      <input type="hidden" name="area" value={current.area} />

      <Field label="টিকা">
        <select name="vaccine" defaultValue={current.vaccine} className={`${control} w-56`}>
          <option value="all">সব টিকা</option>
          {vaccines.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="লক্ষ্য শিশুর বছর">
        <select name="year" defaultValue={current.year} className={`${control} w-28`}>
          {years.map((y) => (
            <option key={y} value={y}>
              {toBn(y)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="ডোজের তারিখ: থেকে" hint={from ? dateBn(from) : "দিন/মাস/বছর"}>
        <input
          type="date"
          name="from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={control}
        />
      </Field>

      <Field label="পর্যন্ত" hint={to ? dateBn(to) : "দিন/মাস/বছর"}>
        <input
          type="date"
          name="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          min={from || undefined}
          className={control}
        />
      </Field>

      {/* An empty label line so the button sits on the same row as the controls. */}
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="h-5" />
        <Button type="submit">ফলাফল দেখুন</Button>
      </div>
    </form>
  );
}

// Every cell has the same three rows — label, control, hint — so the controls line up whether
// or not a field has a hint beneath it.
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
      <span className="h-5 leading-5">{label}</span>
      {children}
      <span className="h-5 leading-5 text-[var(--text-muted)]">{hint}</span>
    </label>
  );
}
