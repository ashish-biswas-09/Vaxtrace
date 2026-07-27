// Card, Section header, and the definition-list Field row — the three shapes that were
// re-declared as local helpers in settings/page.tsx, children/[id]/page.tsx and the dashboard.
//
// The visual change that matters: a card now has its own `--surface` fill sitting above
// `--canvas`. Previously a card was a 1px border on the page background at 1.33:1, so on the
// dark theme the whole panel read as one flat plane.

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

// Header row inside a card: title on the left, an action (usually a "সব দেখুন →" link) right.
export function CardHeader({
  title,
  action,
  className = "",
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {action}
    </div>
  );
}

// A card whose body is a list of label/value rows — the Settings groups and the child-record
// guardian block. Header is a <h2> so the page keeps a real heading outline.
export function GroupCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)]">
      <h2 className="border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 text-[0.8125rem] font-semibold text-[var(--text-secondary)]">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

export function GroupRow({
  label,
  desc,
  value,
}: {
  label: string;
  desc?: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {desc && <p className="text-xs text-[var(--text-muted)]">{desc}</p>}
      </div>
      <div className="shrink-0 text-right">{value}</div>
    </div>
  );
}
