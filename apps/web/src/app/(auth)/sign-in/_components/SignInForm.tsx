"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { requestOtpAction, signInAction, type SignInState } from "../actions";

type Mode = "password" | "otp";

export function SignInForm({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [passwordState, passwordFormAction, passwordPending] = useActionState<
    SignInState,
    FormData
  >(signInAction, undefined);
  const [otpState, otpFormAction, otpPending] = useActionState<SignInState, FormData>(
    requestOtpAction,
    undefined,
  );

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex rounded-lg border border-[var(--color-border)] p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-md py-2 ${mode === "password" ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : ""}`}
        >
          আইডি ও পাসওয়ার্ড
        </button>
        <button
          type="button"
          onClick={() => setMode("otp")}
          className={`flex-1 rounded-md py-2 ${mode === "otp" ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : ""}`}
        >
          ওটিপি
        </button>
      </div>

      {mode === "password" ? (
        <form action={passwordFormAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            ইমেইল
            <input
              name="email"
              type="email"
              required
              className="rounded-md border border-[var(--color-border)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            পাসওয়ার্ড
            <input
              name="password"
              type="password"
              required
              className="rounded-md border border-[var(--color-border)] px-3 py-2"
            />
          </label>
          {passwordState?.error && (
            <p className="text-sm text-[var(--color-danger)]">{passwordState.error}</p>
          )}
          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-md bg-[var(--color-primary)] py-2 text-[var(--color-primary-fg)] disabled:opacity-60"
          >
            {passwordPending ? "লগইন হচ্ছে…" : "লগইন করুন"}
          </button>
        </form>
      ) : (
        <form action={otpFormAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            মোবাইল নম্বর
            <input
              name="phone"
              type="tel"
              placeholder="+8801XXXXXXXXX"
              required
              className="rounded-md border border-[var(--color-border)] px-3 py-2"
            />
          </label>
          {otpState?.error && <p className="text-sm text-[var(--color-danger)]">{otpState.error}</p>}
          <button
            type="submit"
            disabled={otpPending}
            className="rounded-md bg-[var(--color-primary)] py-2 text-[var(--color-primary-fg)] disabled:opacity-60"
          >
            {otpPending ? "পাঠানো হচ্ছে…" : "ওটিপি পাঠান"}
          </button>
        </form>
      )}

      <div className="flex justify-between text-sm text-[var(--color-muted)]">
        <Link href="/sign-up">নতুন অ্যাকাউন্ট</Link>
        <Link href="/verify">পাসওয়ার্ড ভুলে গেছেন?</Link>
      </div>
    </div>
  );
}
