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

/** The last `n` calendar months ending with the current one, as yyyy-mm. */
export function lastMonths(n: number, today = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/** One bar per month, zero-filled: monthly_doses() only returns months that had rows. */
export function fillMonths(rows: { month: string; doses: number }[], months: string[]) {
  const byMonth = new Map(rows.map((r) => [r.month.slice(0, 7), r.doses]));
  return months.map((m) => ({ month: m, doses: byMonth.get(m) ?? 0 }));
}

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTH_BN[Number(m) - 1]} ${toBn(y.slice(2))}`;
};

// Dependency-free CSS bars, consistent with the deviation from Recharts the handbook records
// as ADR-012. A Server Component: there is no interaction here.
//
// The <li> must stretch to the list's height (no `items-end` on the list) — a percentage height
// inside an un-stretched flex item resolves to zero, which is how every bar used to render as
// nothing (K-04).
export function TrendBars({ rows, caption }: { rows: { month: string; doses: number }[]; caption: string }) {
  if (rows.every((r) => r.doses === 0)) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        এই এলাকায় গত ১২ মাসে কোনো ডোজ নথিভুক্ত হয়নি।
      </p>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.doses));

  return (
    <figure>
      <ul aria-hidden="true" className="flex h-44 gap-1 sm:gap-2">
        {rows.map((r, i) => (
          <li key={r.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="hidden text-xs tabular-nums text-[var(--text-muted)] sm:block">
              {toBn(r.doses)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-[var(--accent)]"
                // A zero month has to be visibly zero rather than absent: 1px of bar says "we
                // measured and it was none", no bar at all says "we have no data".
                style={{ height: `${Math.max(1, Math.round((r.doses / max) * 100))}%` }}
              />
            </div>
            {/* Twelve labels do not fit on a phone; every third one does. */}
            <span
              className={`text-xs whitespace-nowrap text-[var(--text-muted)] ${
                i % 3 === 0 ? "" : "invisible sm:visible"
              }`}
            >
              {monthLabel(r.month)}
            </span>
          </li>
        ))}
      </ul>
      {/* sr-only on a wrapper: a <table> ignores the 1px clip and would add blank scroll. */}
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">মাস</th>
            <th scope="col">ডোজ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{monthLabel(r.month)}</td>
              <td>{toBn(r.doses)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
