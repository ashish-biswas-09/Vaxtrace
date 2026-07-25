import { pctBn, toBn } from "@/lib/format";

// Dependency-free CSS bars (Recharts would be ~100KB for a handful of horizontal bars).
// Width encodes the value. Shared by the dashboard and reports so the coverage chart reads
// identically on both.
export function Bar({ ratio, tone }: { ratio: number; tone: string }) {
  return (
    <div className="h-6 w-full overflow-hidden rounded bg-[var(--color-border)]/40">
      <div
        className="h-full rounded"
        style={{ width: `${Math.max(2, Math.round(ratio * 100))}%`, background: tone }}
      />
    </div>
  );
}

export function coverageTone(rate: number | null | undefined): string {
  const r = rate ?? 0;
  return r >= 0.8
    ? "var(--color-success)"
    : r >= 0.5
      ? "var(--color-warning)"
      : "var(--color-danger)";
}

export type CoverageRow = {
  code: string;
  name_bn: string | null;
  coverage_rate: number | null;
  done_count?: number | null;
  due_count?: number | null;
};

// Per-vaccine coverage as a labelled bar list. Values shown numerically beside each bar so
// the chart is informational, not decorative (audit UX-07).
//
// The denominator is shown under the percentage. "১০০%" from one dose and "১০০%" from four
// thousand look identical otherwise, and the difference between those two is the entire
// question a coverage chart is asked.
export function CoverageBars({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">কোনো তথ্য নেই।</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r) => (
        <li
          key={r.code}
          className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_6rem]"
        >
          <span className="truncate" title={r.name_bn ?? r.code}>
            {r.name_bn ?? r.code}
          </span>
          <Bar ratio={r.coverage_rate ?? 0} tone={coverageTone(r.coverage_rate)} />
          <span className="text-right">
            <span className="block tabular-nums">{pctBn(r.coverage_rate)}</span>
            {r.due_count != null && (
              <span className="block text-xs tabular-nums text-[var(--color-muted)]">
                {toBn(r.done_count ?? 0)}/{toBn(r.due_count)}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
