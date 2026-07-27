import { pctBn, toBn, dateBn } from "@/lib/format";

// Dependency-free CSS/SVG charts (Recharts would be ~100KB for a handful of bars). Shared by
// the dashboard and reports so the same measure reads identically on both.

export function Bar({ ratio, tone }: { ratio: number; tone: string }) {
  return (
    <div className="h-6 w-full overflow-hidden rounded-[var(--r-sm)] bg-[var(--surface-raised)]">
      <div
        className="h-full rounded-[var(--r-sm)]"
        style={{ width: `${Math.max(2, Math.round(ratio * 100))}%`, background: tone }}
      />
    </div>
  );
}

export function coverageTone(rate: number | null | undefined): string {
  const r = rate ?? 0;
  return r >= 0.8 ? "var(--success)" : r >= 0.5 ? "var(--warning)" : "var(--danger)";
}

export type CoverageRow = {
  code: string;
  name_bn: string | null;
  coverage_rate: number | null;
  done_count?: number | null;
  due_count?: number | null;
};

/** The programme target every coverage figure is read against. */
export const COVERAGE_TARGET = 0.8;

// Per-vaccine coverage as a labelled bar list, with the value shown numerically beside each
// bar so the chart is informational rather than decorative, and the denominator underneath —
// "১০০%" from one dose and "১০০%" from four thousand look identical otherwise, and the
// difference between those two is the entire question a coverage chart is asked.
export function CoverageBars({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">কোনো তথ্য নেই।</p>;
  }
  return (
    <div className="relative">
      {/* Target line at 80%. A coverage bar with no target is a number without a verdict. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 hidden sm:block"
        style={{ left: `calc(9rem + 0.75rem + (100% - 9rem - 6rem - 1.5rem) * ${COVERAGE_TARGET})` }}
      >
        <div className="h-full border-l border-dashed border-[var(--border-strong)]" />
      </div>

      <ul className="relative flex flex-col gap-4">
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
                <span className="block text-xs tabular-nums text-[var(--text-muted)]">
                  {toBn(r.done_count ?? 0)}/{toBn(r.due_count)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-[var(--text-muted)]">
        ড্যাশ লাইন = লক্ষ্যমাত্রা {pctBn(COVERAGE_TARGET)}
      </p>
    </div>
  );
}

// Filled area + line over a daily series. Bars collapse to invisible hairlines once the window
// is more than about forty points wide, which a 90-day or 1-year scope always is.
export function TrendArea({
  points,
  labels,
  caption,
  color = "var(--accent)",
}: {
  points: number[];
  labels?: string[];
  caption: string;
  color?: string;
}) {
  if (points.length < 2) {
    return <p className="text-sm text-[var(--text-muted)]">কোনো তথ্য নেই।</p>;
  }

  const W = 600;
  const H = 160;
  const max = Math.max(1, ...points);
  const stepX = W / (points.length - 1);
  const y = (v: number) => H - (v / max) * (H - 8) - 4;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const total = points.reduce((a, b) => a + b, 0);

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-40 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${caption} — মোট ${toBn(total)}, সর্বোচ্চ ${toBn(max)}`}
      >
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1="0"
            x2={W}
            y1={y(max * g)}
            y2={y(max * g)}
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill={color} opacity="0.14" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>

      <figcaption className="flex justify-between text-xs text-[var(--text-muted)]">
        <span>{labels?.[0] ? dateBn(labels[0]) : ""}</span>
        <span className="tabular-nums">সর্বোচ্চ {toBn(max)}</span>
        <span>{labels?.[labels.length - 1] ? dateBn(labels[labels.length - 1]) : ""}</span>
      </figcaption>

      {/* A line has no readable values. The same series as a table, for screen readers and
          for anyone who needs the actual number rather than the shape. */}
      {labels && (
        <table className="sr-only">
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">তারিখ</th>
              <th scope="col">সংখ্যা</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={labels[i] ?? i}>
                <td>{dateBn(labels[i])}</td>
                <td>{toBn(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
