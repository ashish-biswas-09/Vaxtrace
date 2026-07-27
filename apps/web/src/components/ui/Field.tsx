"use client";

import { useId } from "react";

// Every form in the admin panel wrote its own `<label className="flex flex-col gap-1 text-sm">`
// wrapping a bare input. Not one of them set aria-invalid, aria-describedby, or associated an
// error message with the control it belonged to — so a screen reader announced "ইমেইল, edit
// text" and nothing else while a red sentence sat unlinked underneath.
//
// Field owns that wiring. Callers get the generated id and ARIA props back and spread them
// onto whatever control they render, so a <select>, a native date input and a custom control
// all get identical semantics.

export const controlClass =
  "h-10 w-full rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-55";

export const controlErrorClass =
  "border-[var(--danger)] bg-[var(--danger-bg)]";

export type ControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: ControlProps) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-[var(--text-secondary)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--danger)]" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

// Form-level error summary. Sits above the fields, takes focus on submit failure, and is a
// live region so the failure is announced rather than silently painted red.
export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--r-md)] border border-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
    >
      {children}
    </div>
  );
}
