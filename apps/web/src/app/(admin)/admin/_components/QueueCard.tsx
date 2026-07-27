import Link from "next/link";

// "How many?" is never the last question — "which ones, and what do I do about them?" is.
// A queue answers all three in one card: the rows, an action per row, and a way through to
// the full list. Used three times on the dashboard.

export type QueueRow = {
  key: string;
  title: string;
  sub?: React.ReactNode;
  badge?: React.ReactNode;
  action?: { href: string; label: string };
};

export function QueueCard({
  title,
  rows,
  emptyLabel,
  allHref,
}: {
  title: string;
  rows: QueueRow[];
  emptyLabel: string;
  allHref: string;
}) {
  return (
    <section className="flex flex-col rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Link href={allHref} className="text-xs text-[var(--accent)] hover:underline">
          সব দেখুন →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-sm text-[var(--text-muted)]">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-1 flex-col divide-y divide-[var(--border-subtle)]">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate text-[var(--text-primary)]">{r.title}</div>
                {r.sub && (
                  <div className="truncate text-xs text-[var(--text-muted)]">{r.sub}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.badge}
                {r.action && (
                  <Link
                    href={r.action.href}
                    className="text-xs whitespace-nowrap text-[var(--accent)] hover:underline"
                  >
                    {r.action.label}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
