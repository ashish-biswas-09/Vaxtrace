"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { InboxIcon, SearchIcon } from "@/components/icons";
import { toBn } from "@/lib/format";
import { Sparkline } from "./Sparkline";

export type Tone = "muted" | "success" | "warning" | "danger" | "primary";

const TONE_VAR: Record<Tone, string> = {
  muted: "var(--text-muted)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  primary: "var(--accent)",
};

const TONE_BG: Record<Tone, string> = {
  muted: "var(--muted-bg)",
  success: "var(--success-bg)",
  warning: "var(--warning-bg)",
  danger: "var(--danger-bg)",
  primary: "var(--accent-bg)",
};

// Tinted fill rather than the outline-only chip this used to be. A 1px border in the tone
// colour, on a background the same colour as the page, read as a disabled control — and on
// dark it inherited the same 1.55:1 problem every other hairline had.
export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-[var(--r-sm)] px-2 py-0.5 text-xs font-medium"
      style={{
        // The tones clear 4.5:1 on white, not on their own 14% tint (light theme measured
        // 4.01–4.49 at 12px). A fifth of --text-primary darkens them in light and lightens
        // them in dark, so the pill clears AA in both themes without new tokens.
        color: `color-mix(in oklab, ${TONE_VAR[tone]} 80%, var(--text-primary))`,
        background: TONE_BG[tone],
        border: `1px solid color-mix(in oklab, ${TONE_VAR[tone]} 35%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

// A period-over-period comparison. `goodDirection` is separate from `direction` because the
// two disagree half the time on this dashboard: missed doses falling is good, coverage
// falling is not, and colouring both by "went down" would be actively misleading.
export type Delta = {
  value: number;
  percent?: number | null;
  direction: "up" | "down" | "flat";
  goodDirection: "up" | "down";
  period?: string;
};

function DeltaChip({ delta }: { delta: Delta }) {
  const { value, percent, direction, goodDirection, period } = delta;
  const tone: Tone =
    direction === "flat" ? "muted" : direction === goodDirection ? "success" : "danger";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "●";
  const label =
    direction === "flat"
      ? "অপরিবর্তিত"
      : `${arrow} ${toBn(Math.abs(value))}${
          percent != null ? ` (${toBn(Math.abs(Math.round(percent * 100)))}%)` : ""
        }`;

  return (
    <span className="inline-flex items-baseline gap-1 text-xs" style={{ color: TONE_VAR[tone] }}>
      <span className="tabular-nums">{label}</span>
      {period && <span className="text-[var(--text-muted)]">{period}</span>}
    </span>
  );
}

// A KPI answers "how are we doing"; the next question is always "show me which ones". When
// `href` is given the whole card becomes that link, so the number is an entry point into the
// list behind it rather than a dead end the reader has to navigate away from by hand.
//
// `delta` is the addition that matters: a KPI without a comparison is a dead number, and none
// of the nine on the old dashboard carried one.
export function StatCard({
  label,
  value,
  hint,
  tone = "primary",
  href,
  delta,
  sparkline,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  href?: string;
  delta?: Delta;
  sparkline?: number[];
}) {
  const body = (
    <>
      <p className="text-[0.8125rem] font-medium text-[var(--text-secondary)]">{label}</p>
      <p
        className="mt-1 text-[2rem] leading-10 font-semibold tabular-nums"
        style={{ color: TONE_VAR[tone] }}
      >
        {value}
      </p>
      {(delta || sparkline) && (
        <div className="mt-1 flex min-h-6 items-center justify-between gap-2">
          {delta ? <DeltaChip delta={delta} /> : <span />}
          {sparkline && sparkline.length > 1 && (
            <Sparkline points={sparkline} color={TONE_VAR[tone]} />
          )}
        </div>
      )}
      {/* Two lines on a phone, where cards sit two to a row; the whole hint from `sm` up. */}
      {hint && (
        <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)] sm:line-clamp-none" title={hint}>
          {hint}
        </p>
      )}
    </>
  );

  const base =
    "block rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-5";
  if (!href) return <div className={base}>{body}</div>;

  return (
    <Link
      href={href}
      className={`${base} transition-colors duration-[var(--dur-fast)] hover:border-[var(--accent)]`}
    >
      {body}
      <span className="mt-2 block text-xs text-[var(--accent)]">বিস্তারিত →</span>
    </Link>
  );
}

// Submit button that reflects the enclosing <form>'s pending state. Now a thin wrapper over
// the shared Button, so a form action and a plain action are visually identical.
//
// `name`/`value` are passed through so one form can carry two decisions (approve / reject)
// without a hidden field. A hidden field would always be submitted and would win the
// `formData.get()` race against the button that was actually clicked; a submitter's own
// name/value is only sent when that button is the one that submitted.
export function SubmitButton({
  children,
  variant = "primary",
  size,
  name,
  value,
}: {
  children: React.ReactNode;
  /** @deprecated the label no longer swaps while pending — the spinner carries that, and
   *  swapping it reflowed the button mid-click. Accepted so callers need not change. */
  pendingLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name={name} value={value} variant={variant} size={size} loading={pending}>
      {children}
    </Button>
  );
}

// One page header, so every admin screen has the same title/description/actions geometry and
// the same `print:hidden` on its action row. `meta` carries the line a screen needs to date
// itself — a dashboard that gets screenshotted into a report has to say when it was taken.
export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">{description}</p>
        )}
        {meta && <p className="mt-1 text-xs text-[var(--text-muted)]">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </header>
  );
}

// An empty list is a question ("what now?"), not a full stop. This states what is missing and
// offers the one action that fixes it.
//
// `variant` separates the two states that were rendering identically: "nothing exists yet"
// wants a create button, "your filter matched nothing" wants the filter cleared.
export function EmptyState({
  title,
  hint,
  action,
  variant = "empty",
  icon,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
  variant?: "empty" | "no-results";
  icon?: React.ReactNode;
}) {
  const Fallback = variant === "no-results" ? SearchIcon : InboxIcon;
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--border-default)] px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)]">
        {icon ?? <Fallback size={22} />}
      </span>
      <div>
        <p className="font-medium text-[var(--text-primary)]">{title}</p>
        {hint && <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">{hint}</p>}
      </div>
      {action && (
        <Button href={action.href} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// A banner for a server action's result. Both branches carry `role="status"` so a screen
// reader announces the outcome; a form that only *looks* like it worked is a form that gets
// submitted twice.
export function FormMessage({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  const tone = error ? "var(--danger)" : "var(--success)";
  const bg = error ? "var(--danger-bg)" : "var(--success-bg)";
  return (
    <p
      role="status"
      className="rounded-[var(--r-md)] border px-3 py-2 text-sm"
      style={{ color: tone, borderColor: tone, background: bg }}
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

  return (
    <>
      <Button
        variant={variant === "danger" ? "danger" : "secondary"}
        size="sm"
        onClick={() => ref.current?.showModal()}
      >
        {label}
      </Button>

      <dialog
        ref={ref}
        // The backdrop is styled through the browser's ::backdrop; `m-auto` is what makes the
        // box centre itself without a wrapper div.
        className="m-auto w-[min(28rem,92vw)] rounded-[var(--r-xl)] border border-[var(--border-default)] bg-[var(--surface)] p-5 text-[var(--text-primary)] shadow-[var(--shadow-2)] backdrop:bg-black/60"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">{body}</div>

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
              className="mt-1 h-10 w-full rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setTyped("");
              ref.current?.close();
            }}
          >
            বাতিল
          </Button>
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
  return (
    <Button
      type="submit"
      name={name}
      value={value}
      variant={variant === "danger" ? "danger" : "primary"}
      disabled={disabled}
      loading={pending}
    >
      {children}
    </Button>
  );
}
