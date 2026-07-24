"use client";

import { useActionState } from "react";
import { resetPwAction, type VerifyState } from "../actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(
    resetPwAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        ইমেইল
        <input
          name="email"
          type="email"
          required
          className="rounded-md border border-[var(--color-border)] px-3 py-2"
        />
      </label>
      {state?.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state?.message && <p className="text-sm text-[var(--color-success)]">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-primary)] py-2 text-[var(--color-primary-fg)] disabled:opacity-60"
      >
        {pending ? "পাঠানো হচ্ছে…" : "রিসেট লিংক পাঠান"}
      </button>
    </form>
  );
}
