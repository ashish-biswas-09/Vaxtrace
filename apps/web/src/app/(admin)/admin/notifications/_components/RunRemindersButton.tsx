"use client";

import { useActionState } from "react";
import { runRemindersAction, type RunState } from "../_actions";

// Privileged trigger, so it asks first (audit UX-02). The action is idempotent, but a
// confirm is still right: the operator should know they are queueing messages to guardians.
export function RunRemindersButton() {
  const [state, action, pending] = useActionState<RunState, FormData>(
    () => runRemindersAction(),
    undefined,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm("এখনই রিমাইন্ডার সারি তৈরি করবেন?")) e.preventDefault();
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "চলছে…" : "এখনই সারি তৈরি করুন"}
        </button>
      </form>
      {state?.ok && (
        <span role="status" className="text-xs text-[var(--color-success)]">
          {state.ok}
        </span>
      )}
      {state?.error && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          {state.error}
        </span>
      )}
    </div>
  );
}
