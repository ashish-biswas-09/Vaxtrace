"use client";

import { useActionState } from "react";
import { SubmitButton } from "../../_components/ui";
import { reviewBreakGlassAction, type ReviewState } from "../_actions";

export function ReviewButton({ id }: { id: string }) {
  const [state, review] = useActionState<ReviewState, FormData>(
    reviewBreakGlassAction,
    undefined,
  );

  return (
    <form action={review}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" pendingLabel="…">
        পর্যালোচিত
      </SubmitButton>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
