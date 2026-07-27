"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { toBn } from "@/lib/format";
import { verifyOtpAction, type VerifyState } from "../actions";

const LENGTH = 6;
const RESEND_SECONDS = 60;

// Six boxes rather than one text field. A single `maxLength={6}` input gives no sense of
// progress, no per-digit target on a phone, and pastes badly — the code arrives in an SMS and
// is pasted, not typed, so paste has to fill all six at once rather than land in box one.
export function VerifyOtpForm({ phone }: { phone: string }) {
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(
    verifyOtpAction,
    undefined,
  );
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [left, setLeft] = useState(RESEND_SECONDS);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  function setAt(i: number, v: string) {
    const next = [...digits];
    next[i] = v;
    setDigits(next);
  }

  function onChange(i: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return setAt(i, "");
    if (clean.length > 1) {
      // A paste. Spread it across the boxes from here and focus the last one filled.
      const next = [...digits];
      for (let k = 0; k < clean.length && i + k < LENGTH; k++) next[i + k] = clean[k];
      setDigits(next);
      refs.current[Math.min(i + clean.length, LENGTH - 1)]?.focus();
      return;
    }
    setAt(i, clean);
    if (i < LENGTH - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      setAt(i - 1, "");
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < LENGTH - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  const token = digits.join("");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">ওটিপি যাচাই</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          <span className="font-mono">{phone}</span> নম্বরে পাঠানো ৬ সংখ্যার কোড দিন
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="token" value={token} />

        <FormError>{state?.error}</FormError>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="pb-1.5 text-[0.8125rem] font-medium text-[var(--text-secondary)]">
            ওটিপি কোড
          </legend>
          <div className="flex gap-2" dir="ltr">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={d}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`অঙ্ক ${toBn(i + 1)}`}
                aria-invalid={state?.error ? true : undefined}
                className={`h-12 w-full rounded-[var(--r-md)] border bg-[var(--surface)] text-center font-mono text-lg text-[var(--text-primary)] ${
                  state?.error ? "border-[var(--danger)]" : "border-[var(--border-strong)]"
                }`}
              />
            ))}
          </div>
        </fieldset>

        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={token.length < LENGTH}
          className="w-full"
        >
          যাচাই করুন
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--text-muted)]">
        {left > 0 ? (
          <>কোড পাননি? {toBn(left)} সেকেন্ড পর আবার পাঠানো যাবে</>
        ) : (
          <a href="/sign-in?role=parent" className="text-[var(--accent)] hover:underline">
            আবার কোড পাঠান
          </a>
        )}
      </p>
    </div>
  );
}
