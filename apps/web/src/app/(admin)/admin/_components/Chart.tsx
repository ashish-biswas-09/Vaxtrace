import { pctBn, toBn, dateBn } from "@/lib/format";
import { COVERAGE_TARGET, TONE_CSS, coverageTone } from "@/lib/programme";

// Dependency-free CSS/SVG charts (Recharts would be ~100KB for a handful of bars). Shared by
// the dashboard and reports so the same measure reads identically on both.

// A thin bar on a visible track, with the target drawn inside the track itself. The target used
// to be one absolutely-positioned line over the whole list, placed with a calc() that had to
// agree with the grid's column widths — it drifted, and the track was white on white.
export function Bar({ ratio, tone, target }: { ratio: number; tone: string; target?: number }) {
  return (
    <div aria-hidden="true" className="relative h-2.5 w-full rounded-full bg-[var(--surface-sunken)]">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(1.5, ratio * 100))}%`, background: tone }}
      />
      {target != null && (
        <span
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-[var(--text-secondary)]"
          style={{ left: `calc(${target * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}

export type CoverageRow = {
  code: string;
  name_bn: string | null;
  coverage_rate: number | null;
  done_count?: number | null;
  due_count?: number | null;
};

// Per-vaccine coverage as a labelled bar list, with the value shown numerically beside each
// bar so the chart is informational rather than decorative, and the denominator underneath —
// "১০০%" from one dose and "১০০%" from four thousand look identical otherwise, and the
// difference between those two is the entire question a coverage chart is asked.
export function CoverageBars({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">কোনো তথ্য নেই।</p>;
  }
  // A coverage bar with no target is a number without a verdict; the summary line is that
  // verdict for the whole list, readable before any bar is.
  const met = rows.filter((r) => (r.coverage_rate ?? 0) >= COVERAGE_TARGET).length;
  const swatch = (tone: keyof typeof TONE_CSS, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: TONE_CSS[tone] }} />
      {label}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--text-secondary)]">
        <strong className="text-[var(--text-primary)]">
          {toBn(met)}/{toBn(rows.length)}
        </strong>{" "}
        টি টিকা লক্ষ্যমাত্রা ({pctBn(COVERAGE_TARGET)}) পূরণ করেছে
      </p>

      <ul className="flex flex-col">
        {rows.map((r) => {
          const tone = coverageTone(r.coverage_rate);
          return (
            <li
              key={r.code}
              className="grid grid-cols-[7rem_1fr_7rem] items-center gap-3 border-t border-[var(--border-subtle)] py-2.5 text-sm first:border-t-0 sm:grid-cols-[9rem_1fr_8rem] sm:gap-4"
            >
              <span className="truncate" title={r.name_bn ?? r.code}>
                {r.name_bn ?? r.code}
              </span>
              <Bar ratio={r.coverage_rate ?? 0} tone={TONE_CSS[tone]} target={COVERAGE_TARGET} />
              <span className="flex items-baseline justify-end gap-2 whitespace-nowrap">
                <span className="font-semibold tabular-nums" style={{ color: TONE_CSS[tone] }}>
                  {pctBn(r.coverage_rate)}
                </span>
                {r.due_count != null && (
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">
                    {toBn(r.done_count ?? 0)}/{toBn(r.due_count)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-[var(--text-secondary)]" />
          লক্ষ্যমাত্রা {pctBn(COVERAGE_TARGET)}
        </span>
        {swatch("success", `${pctBn(COVERAGE_TARGET)} বা বেশি`)}
        {swatch("warning", "৭০–৮৯%")}
        {swatch("danger", "৭০%-এর কম")}
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
  // A flat line at zero labelled "সর্বোচ্চ ১" reads as a broken chart; say what it means.
  if (points.every((p) => p === 0)) {
    return <p className="text-sm text-[var(--text-muted)]">এই সময়ে কোনো ডোজ নথিভুক্ত হয়নি।</p>;
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
      {/* sr-only on a wrapper, not on the <table>: a table ignores the 1px height clip, so the
          hidden rows used to hang ~480px below the page as empty scroll space. */}
      {labels && (
        <div className="sr-only">
        <table>
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
        </div>
      )}
    </figure>
  );
}
