"use client";

import { useActionState } from "react";
import { toBn } from "@/lib/format";
import { SubmitButton } from "@/components/ui/kit";
import { refreshBoardAction, type TracingState } from "../_actions";

// Raising the board is additive and idempotent — generate_tracing_tasks() skips any child who
// already has an open task — so it needs no confirmation dialog. What it does need is to say
// how many children are currently un-tracked, so the button is a decision rather than a poke.
export function RefreshBoardButton({ untracked }: { untracked: number }) {
  const [state, run] = useActionState<TracingState, FormData>(
    () => refreshBoardAction(),
    undefined,
  );

  return (
    <form action={run} className="flex items-center gap-2">
      <SubmitButton variant={untracked > 0 ? "primary" : "ghost"} pendingLabel="তৈরি হচ্ছে…">
        {untracked > 0 ? `${toBn(untracked)} জনের কাজ তৈরি করুন` : "তালিকা হালনাগাদ করুন"}
      </SubmitButton>
      {state?.ok && <span className="text-xs text-[var(--color-success)]">{state.ok}</span>}
      {state?.error && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
