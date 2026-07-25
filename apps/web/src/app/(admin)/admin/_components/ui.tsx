"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

type Tone = "muted" | "success" | "warning" | "danger" | "primary";

const TONE_VAR: Record<Tone, string> = {
  muted: "var(--color-muted)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  primary: "var(--color-primary)",
};

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: TONE_VAR[tone], border: `1px solid ${TONE_VAR[tone]}` }}
    >
      {children}
    </span>
  );
}

// A KPI answers "how are we doing"; the next question is always "show me which ones". When
// `href` is given the whole card becomes that link, so the number is an entry point into the
// list behind it rather than a dead end the reader has to navigate away from by hand.
export function StatCard({
  label,
  value,
  hint,
  tone = "primary",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold" style={{ color: TONE_VAR[tone] }}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
    </>
  );

  const base = "block rounded-xl border border-[var(--color-border)] p-4";
  if (!href) return <div className={base}>{body}</div>;

  return (
    <Link
      href={href}
      className={`${base} transition-colors hover:border-[var(--color-primary)]`}
    >
      {body}
      <span className="mt-2 block text-xs text-[var(--color-primary)]">বিস্তারিত →</span>
    </Link>
  );
}

// Submit button that reflects the enclosing <form>'s pending state.
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "danger" | "ghost";
}) {
  const { pending } = useFormStatus();
  const base = "rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60";
  const styles =
    variant === "danger"
      ? "bg-[var(--color-danger)] text-white"
      : variant === "ghost"
        ? "border border-[var(--color-border)]"
        : "bg-[var(--color-primary)] text-[var(--color-primary-fg)]";
  return (
    <button type="submit" disabled={pending} className={`${base} ${styles}`}>
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
