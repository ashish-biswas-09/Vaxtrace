"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
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
//
// `name`/`value` are passed through so one form can carry two decisions (approve / reject)
// without a hidden field. A hidden field would always be submitted and would win the
// `formData.get()` race against the button that was actually clicked; a submitter's own
// name/value is only sent when that button is the one that submitted.
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "danger" | "ghost";
  name?: string;
  value?: string;
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
    <button type="submit" name={name} value={value} disabled={pending} className={`${base} ${styles}`}>
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}

// One page header, so every admin screen has the same title/description/actions geometry and
// the same `print:hidden` on its action row. Audit UX-02: the previous nine screens each
// hand-rolled this and three of them drifted.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </header>
  );
}

// An empty list is a question ("what now?"), not a full stop. This states what is missing and
// offers the one action that fixes it — the rule the Children screen already followed and the
// other eight did not.
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-muted)]">{hint}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

// A banner for a server action's result. Both branches carry `role="status"` so a screen
// reader announces the outcome; a form that only *looks* like it worked is a form that gets
// submitted twice.
export function FormMessage({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  const tone = error ? "var(--color-danger)" : "var(--color-success)";
  return (
    <p
      role="status"
      className="rounded-md border px-3 py-2 text-sm"
      style={{ color: tone, borderColor: tone }}
    >
      {error ?? ok}
    </p>
  );
}

// UX-05: nothing irreversible happens on one click.
//
// Built on the native <dialog> element rather than a modal library — it brings the focus trap,
// the Escape handler, the inert background and the top-layer stacking with it, and all of that
// is exactly what a hand-rolled overlay gets wrong. The real submit button lives inside the
// dialog, so the destructive action cannot fire until the dialog has been read.
//
// `typedConfirmation` is for the acts that are not merely irreversible but destructive of
// history — a merge, a deletion. Typing the word is a deliberate speed bump, and it is the
// difference between "I clicked the wrong row" and "I meant this row".
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  variant = "danger",
  typedConfirmation,
  name,
  value,
}: {
  label: string;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "danger" | "ghost";
  typedConfirmation?: string;
  name?: string;
  value?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const ready = !typedConfirmation || typed.trim() === typedConfirmation;

  const trigger =
    variant === "danger"
      ? "border-[var(--color-danger)] text-[var(--color-danger)]"
      : "border-[var(--color-border)]";

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={`rounded-md border px-3 py-1.5 text-sm font-medium ${trigger}`}
      >
        {label}
      </button>

      <dialog
        ref={ref}
        // The backdrop is styled through the browser's ::backdrop; `open:flex` is what makes
        // the box centre itself without a wrapper div.
        className="m-auto w-[min(28rem,92vw)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-[var(--color-fg)] backdrop:bg-black/50"
      >
        <h2 className="text-lg font-medium">{title}</h2>
        <div className="mt-2 text-sm text-[var(--color-muted)]">{body}</div>

        {typedConfirmation && (
          <div className="mt-4">
            <label htmlFor={inputId} className="block text-sm">
              নিশ্চিত করতে <strong className="font-mono">{typedConfirmation}</strong> লিখুন
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setTyped("");
              ref.current?.close();
            }}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            বাতিল
          </button>
          <ConfirmSubmit disabled={!ready} variant={variant} name={name} value={value}>
            {confirmLabel ?? label}
          </ConfirmSubmit>
        </div>
      </dialog>
    </>
  );
}

function ConfirmSubmit({
  children,
  disabled,
  variant,
  name,
  value,
}: {
  children: React.ReactNode;
  disabled: boolean;
  variant: "primary" | "danger" | "ghost";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "danger"
      ? "bg-[var(--color-danger)] text-white"
      : "bg-[var(--color-primary)] text-[var(--color-primary-fg)]";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles}`}
    >
      {pending ? "…" : children}
    </button>
  );
}
