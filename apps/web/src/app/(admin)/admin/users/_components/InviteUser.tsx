"use client";

import { useActionState, useState } from "react";
import { inviteUserAction, type UserActionState } from "../_actions";

const ROLES = [
  { value: "worker", label: "স্বাস্থ্যকর্মী" },
  { value: "admin", label: "অ্যাডমিন" },
  { value: "parent", label: "অভিভাবক" },
];

const field =
  "mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

// `<dialog>` rather than a hand-rolled overlay: the browser gives the focus trap, the
// Escape-to-close and the backdrop for free, and gets the accessibility right without a
// dependency.
export function InviteUser() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    inviteUserAction,
    undefined,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
      >
        + আমন্ত্রণ পাঠান
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ব্যবহারকারী আমন্ত্রণ"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="বন্ধ করুন"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/60"
          />
          <div className="relative w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h2 className="text-lg font-medium">ব্যবহারকারী আমন্ত্রণ</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              আমন্ত্রিত অ্যাকাউন্ট প্রথমে <strong>আমন্ত্রিত</strong> অবস্থায় থাকে — সক্রিয় না করা
              পর্যন্ত ভূমিকাভিত্তিক কোনো তথ্যে প্রবেশ করতে পারবে না।
            </p>

            <form action={action} className="mt-4 flex flex-col gap-3">
              <label className="text-xs text-[var(--color-muted)]">
                পূর্ণ নাম
                <input name="full_name" required maxLength={120} className={field} />
              </label>
              <label className="text-xs text-[var(--color-muted)]">
                ইমেইল
                <input type="email" name="email" required className={field} />
              </label>
              <label className="text-xs text-[var(--color-muted)]">
                ভূমিকা
                <select name="role" defaultValue="worker" className={field}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value} className="text-black">
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              {state?.error && (
                <p role="alert" className="text-xs text-[var(--color-danger)]">
                  {state.error}
                </p>
              )}
              {state?.ok && (
                <p role="status" className="text-xs text-[var(--color-success)]">
                  {state.ok}
                </p>
              )}

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  বন্ধ
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] disabled:opacity-60"
                >
                  {pending ? "পাঠানো হচ্ছে…" : "আমন্ত্রণ পাঠান"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
