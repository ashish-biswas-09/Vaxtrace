import { pctBn } from "@/lib/format";

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

export type CoverageRow = { code: string; name_bn: string | null; coverage_rate: number | null };

// Per-vaccine coverage as a labelled bar list. Values shown numerically beside each bar so
// the chart is informational, not decorative (audit UX-07).
export function CoverageBars({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">কোনো তথ্য নেই।</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.code} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate">{r.name_bn ?? r.code}</span>
          <Bar ratio={r.coverage_rate ?? 0} tone={coverageTone(r.coverage_rate)} />
          <span className="text-right tabular-nums">{pctBn(r.coverage_rate)}</span>
        </div>
      ))}
    </div>
  );
}
