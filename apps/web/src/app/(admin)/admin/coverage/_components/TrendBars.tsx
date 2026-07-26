import { toBn } from "@/lib/format";

const MONTH_BN = [
  "জানু",
  "ফেব",
  "মার্চ",
  "এপ্রি",
  "মে",
  "জুন",
  "জুলা",
  "আগ",
  "সেপ",
  "অক্টো",
  "নভে",
  "ডিসে",
];

// Dependency-free CSS bars, consistent with the deviation from Recharts the handbook records
// as ADR-012. A Server Component: there is no interaction here, so shipping a charting runtime
// to the browser would buy nothing.
export function TrendBars({ rows }: { rows: { month: string; doses: number }[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        এই এলাকায় গত ১২ মাসে কোনো ডোজ নথিভুক্ত হয়নি।
      </p>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.doses));

  return (
    <ul className="flex h-40 items-end gap-2">
      {rows.map((r) => {
        const [y, m] = r.month.slice(0, 7).split("-");
        const label = `${MONTH_BN[Number(m) - 1]} ${toBn(y.slice(2))}`;
        return (
          <li key={r.month} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
              {toBn(r.doses)}
            </span>
            <div
              className="w-full rounded-t bg-[var(--color-primary)]"
              // A zero month has to be visibly zero rather than absent: 1px of bar says "we
              // measured and it was none", no bar at all says "we have no data".
              style={{ height: `${Math.max(1, Math.round((r.doses / max) * 100))}%` }}
            />
            <span className="text-[10px] whitespace-nowrap text-[var(--color-muted)]">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
