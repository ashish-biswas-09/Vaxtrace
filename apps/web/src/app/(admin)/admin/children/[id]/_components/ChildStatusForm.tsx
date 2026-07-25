"use client";

import { useActionState, useState } from "react";
import { CHILD_STATUS, CHILD_STATUSES, type ChildStatus } from "@/lib/guardians";
import { SubmitButton } from "../../../_components/ui";
import { setChildStatusAction, type ChildStatusState } from "../_actions";

export function ChildStatusForm({
  childId,
  current,
}: {
  childId: string;
  current: ChildStatus;
}) {
  const [state, save] = useActionState<ChildStatusState, FormData>(
    setChildStatusAction,
    undefined,
  );
  const [next, setNext] = useState<ChildStatus>(current);

  const meta = CHILD_STATUS[next];
  const stopsMessaging = !meta.reachable;

  return (
    <form action={save} className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4">
      <input type="hidden" name="child_id" value={childId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[var(--color-muted)]">
          অবস্থা পরিবর্তন
          <select
            name="status"
            value={next}
            onChange={(e) => setNext(e.target.value as ChildStatus)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {CHILD_STATUSES.map((s) => (
              <option key={s} value={s} className="text-black">
                {CHILD_STATUS[s].label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          কারণ {next !== "active" && <span className="text-[var(--color-danger)]">*</span>}
          <input
            name="reason"
            maxLength={300}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      {stopsMessaging && next !== current && (
        // Said before the click, not after. The person doing this needs to know that it is
        // the reminders that stop, not just a label that changes.
        <p className="rounded-md border border-[var(--color-warning)] px-3 py-2 text-xs text-[var(--color-warning)]">
          এই অবস্থায় পরিবর্তন করলে এই শিশুর জন্য সব রিমাইন্ডার তাৎক্ষণিকভাবে বন্ধ হবে, এবং সারিতে
          অপেক্ষমাণ বার্তাগুলোও বাতিল হবে।
        </p>
      )}

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-[var(--color-success)]">{state.ok}</p>}

      <SubmitButton
        variant={stopsMessaging && next !== current ? "danger" : "primary"}
        pendingLabel="সংরক্ষণ হচ্ছে…"
      >
        অবস্থা সংরক্ষণ করুন
      </SubmitButton>
    </form>
  );
}
