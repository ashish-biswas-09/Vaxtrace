"use client";

import { useActionState } from "react";
import { verifyOtpAction, type VerifyState } from "../actions";

export function VerifyOtpForm({ phone }: { phone: string }) {
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(
    verifyOtpAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="phone" value={phone} />
      <p className="text-sm text-[var(--color-muted)]">{phone} নম্বরে পাঠানো ৬ সংখ্যার কোড দিন</p>
      <label className="flex flex-col gap-1 text-sm">
        ওটিপি কোড
        <input
          name="token"
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          className="rounded-md border border-[var(--color-border)] px-3 py-2 tracking-widest"
        />
      </label>
      {state?.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-primary)] py-2 text-[var(--color-primary-fg)] disabled:opacity-60"
      >
        {pending ? "যাচাই হচ্ছে…" : "যাচাই করুন"}
      </button>
    </form>
  );
}
