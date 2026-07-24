"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type SignUpState } from "../actions";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpState, FormData>(
    signUpAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        পূর্ণ নাম
        <input
          name="fullName"
          type="text"
          required
          className="rounded-md border border-[var(--color-border)] px-3 py-2"
        />
      </label>
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
          minLength={8}
          className="rounded-md border border-[var(--color-border)] px-3 py-2"
        />
      </label>
      {state?.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-primary)] py-2 text-[var(--color-primary-fg)] disabled:opacity-60"
      >
        {pending ? "তৈরি হচ্ছে…" : "অ্যাকাউন্ট তৈরি করুন"}
      </button>
      <Link href="/sign-in" className="text-center text-sm text-[var(--color-muted)]">
        ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন
      </Link>
    </form>
  );
}
