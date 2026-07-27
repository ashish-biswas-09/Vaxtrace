"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError, controlClass, controlErrorClass } from "@/components/ui/Field";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { requestOtpAction, signInAction, type SignInState } from "../actions";

type Mode = "password" | "otp";

const TABS: { mode: Mode; label: string }[] = [
  { mode: "password", label: "আইডি ও পাসওয়ার্ড" },
  { mode: "otp", label: "ওটিপি" },
];

export function SignInForm({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ password: null, otp: null });
  const [reveal, setReveal] = useState(false);
  const [caps, setCaps] = useState(false);

  const [pwState, pwAction, pwPending] = useActionState<SignInState, FormData>(
    signInAction,
    undefined,
  );
  const [otpState, otpAction, otpPending] = useActionState<SignInState, FormData>(
    requestOtpAction,
    undefined,
  );

  // Two buttons with a background colour were not a tablist: nothing announced the selection
  // and arrow keys did nothing. This is the WAI-ARIA pattern — roving tabindex, arrows move,
  // aria-selected states the choice.
  function onTabKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Mode = mode === "password" ? "otp" : "password";
    setMode(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">লগইন করুন</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          আপনার অ্যাকাউন্টে প্রবেশ করে টিকার তথ্য দেখুন
        </p>
      </div>

      <div
        role="tablist"
        aria-label="লগইন পদ্ধতি"
        onKeyDown={onTabKey}
        className="flex gap-1 rounded-[var(--r-md)] border border-[var(--border-default)] bg-[var(--surface)] p-1 text-sm"
      >
        {TABS.map((t) => (
          <button
            key={t.mode}
            ref={(el) => {
              tabRefs.current[t.mode] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.mode}`}
            aria-selected={mode === t.mode}
            aria-controls={`panel-${t.mode}`}
            tabIndex={mode === t.mode ? 0 : -1}
            onClick={() => setMode(t.mode)}
            className={`flex-1 rounded-[var(--r-sm)] py-2 transition-colors ${
              mode === t.mode
                ? "bg-[var(--accent)] font-medium text-[var(--accent-fg)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form
          action={pwAction}
          id="panel-password"
          role="tabpanel"
          aria-labelledby="tab-password"
          className="flex flex-col gap-4"
        >
          <FormError>{pwState?.error}</FormError>

          <Field label="ইমেইল" required>
            {(p) => (
              <input
                {...p}
                name="email"
                type="email"
                autoComplete="username"
                className={`${controlClass} ${pwState?.error ? controlErrorClass : ""}`}
              />
            )}
          </Field>

          <Field label="পাসওয়ার্ড" required hint={caps ? "ক্যাপস লক চালু আছে" : undefined}>
            {(p) => (
              <div className="relative">
                <input
                  {...p}
                  name="password"
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
                  className={`${controlClass} pr-11 ${pwState?.error ? controlErrorClass : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  aria-pressed={reveal}
                  aria-label={reveal ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                  className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--r-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {reveal ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            )}
          </Field>

          <Button type="submit" size="lg" loading={pwPending} className="w-full">
            লগইন করুন
          </Button>
        </form>
      ) : (
        <form
          action={otpAction}
          id="panel-otp"
          role="tabpanel"
          aria-labelledby="tab-otp"
          className="flex flex-col gap-4"
        >
          <FormError>{otpState?.error}</FormError>

          <Field
            label="মোবাইল নম্বর"
            required
            hint="যে নম্বরে ওটিপি পাঠানো হবে"
          >
            {(p) => (
              <input
                {...p}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+8801XXXXXXXXX"
                className={`${controlClass} ${otpState?.error ? controlErrorClass : ""}`}
              />
            )}
          </Field>

          <Button type="submit" size="lg" loading={otpPending} className="w-full">
            ওটিপি পাঠান
          </Button>
        </form>
      )}

      <div className="flex justify-between text-sm">
        <Link href="/sign-up" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
          নতুন অ্যাকাউন্ট
        </Link>
        <Link href="/verify" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
          পাসওয়ার্ড ভুলে গেছেন?
        </Link>
      </div>
    </div>
  );
}
