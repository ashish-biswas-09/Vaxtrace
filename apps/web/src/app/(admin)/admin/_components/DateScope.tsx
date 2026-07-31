"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "@/components/icons";
import { DEFAULT_RANGE, RANGES } from "./ranges";

// Nothing on the admin surface could be scoped to a period: every number was "all time" or
// "now", and a coverage figure with no window is not a figure a programme officer can quote.
//
// The window lives in the URL so a scoped view is shareable and survives a reload, and only
// the two screens that actually read it render the control.

const SCOPED = ["/admin", "/admin/reports"];

export function DateScope() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();

  if (!SCOPED.includes(pathname)) return null;

  const current = params.get("range") ?? DEFAULT_RANGE;

  return (
    <div className="relative hidden sm:block">
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("range", e.target.value);
          router.push(`${pathname}?${next}`);
        }}
        aria-label="সময়সীমা"
        className="h-9 appearance-none rounded-[var(--r-md)] border border-[var(--border-default)] bg-[var(--surface)] pr-8 pl-3 text-sm text-[var(--text-secondary)]"
      >
        {RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        size={16}
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[var(--text-muted)]"
      />
    </div>
  );
}
