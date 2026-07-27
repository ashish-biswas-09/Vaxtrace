"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError, controlClass, controlErrorClass } from "@/components/ui/Field";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { signUpAction, type SignUpState } from "../actions";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpState, FormData>(
    signUpAction,
    undefined,
  );
  const [reveal, setReveal] = useState(false);
  const [pw, setPw] = useState("");

  // Four cheap signals rather than a scoring library. The bar is guidance, not a gate — the
  // 8-character minimum is what is actually enforced, server-side.
  const score = [pw.length >= 8, pw.length >= 12, /[^a-zA-Z0-9]/.test(pw), /\d/.test(pw)].filter(
    Boolean,
  ).length;
  const strength =
    pw.length === 0
      ? null
      : score <= 1
        ? { label: "দুর্বল", tone: "var(--danger)", pct: 33 }
        : score === 2 || score === 3
          ? { label: "মোটামুটি", tone: "var(--warning)", pct: 66 }
          : { label: "শক্তিশালী", tone: "var(--success)", pct: 100 };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">নতুন অ্যাকাউন্ট</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          অভিভাবক হিসেবে নিবন্ধন করে সন্তানের টিকার রেকর্ড দেখুন
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <FormError>{state?.error}</FormError>

        <Field label="পূর্ণ নাম" required>
          {(p) => (
            <input
              {...p}
              name="fullName"
              type="text"
              autoComplete="name"
              className={`${controlClass} ${state?.error ? controlErrorClass : ""}`}
            />
          )}
        </Field>

        <Field label="ইমেইল" required>
          {(p) => (
            <input
              {...p}
              name="email"
              type="email"
              autoComplete="email"
              className={`${controlClass} ${state?.error ? controlErrorClass : ""}`}
            />
          )}
        </Field>

        <Field label="পাসওয়ার্ড" required hint="কমপক্ষে ৮ অক্ষর">
          {(p) => (
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <input
                  {...p}
                  name="password"
                  type={reveal ? "text" : "password"}
                  minLength={8}
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className={`${controlClass} pr-11 ${state?.error ? controlErrorClass : ""}`}
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
              {strength && (
                <div className="flex items-center gap-2">
                  <div
                    className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{ width: `${strength.pct}%`, background: strength.tone }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: strength.tone }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>
          )}
        </Field>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          অ্যাকাউন্ট তৈরি করুন
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--text-muted)]">
        ইতিমধ্যে অ্যাকাউন্ট আছে?{" "}
        <Link href="/sign-in" className="text-[var(--accent)] hover:underline">
          লগইন করুন
        </Link>
      </p>
    </div>
  );
}
