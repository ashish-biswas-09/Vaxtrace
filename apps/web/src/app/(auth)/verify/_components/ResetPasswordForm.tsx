"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError, controlClass, controlErrorClass } from "@/components/ui/Field";
import { resetPwAction, type VerifyState } from "../actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(
    resetPwAction,
    undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">পাসওয়ার্ড রিসেট</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          অ্যাকাউন্টের ইমেইল দিন — রিসেট লিংক সেখানে পাঠানো হবে
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <FormError>{state?.error}</FormError>
        {state?.message && (
          <p
            role="status"
            className="rounded-[var(--r-md)] border border-[var(--success)] bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]"
          >
            {state.message}
          </p>
        )}

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

        <Button type="submit" size="lg" loading={pending} className="w-full">
          রিসেট লিংক পাঠান
        </Button>
      </form>
    </div>
  );
}
