"use client";

import { useActionState } from "react";
import { saveDoseNoteAction, type NoteState } from "../_actions";

// Inline amendment for one administered dose. `<details>` rather than a modal: an adverse
// event is read far more often than it is written, so the default state is "show the text",
// and the editor is one native disclosure away with no focus trap to get wrong.
export function DoseNote({
  recordId,
  childId,
  notes,
  adverseEvent,
}: {
  recordId: string;
  childId: string;
  notes: string | null;
  adverseEvent: string | null;
}) {
  const [state, action, pending] = useActionState<NoteState, FormData>(
    saveDoseNoteAction,
    undefined,
  );

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs text-[var(--color-muted)] marker:content-['']">
        {adverseEvent ? (
          <span className="text-[var(--color-danger)]">⚠ {adverseEvent}</span>
        ) : notes ? (
          <span>{notes}</span>
        ) : (
          <span className="text-[var(--color-primary)] group-open:hidden">+ মন্তব্য যোগ করুন</span>
        )}
      </summary>

      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="record_id" value={recordId} />
        <input type="hidden" name="child_id" value={childId} />
        <label className="text-xs text-[var(--color-muted)]">
          মন্তব্য
          <textarea
            name="notes"
            defaultValue={notes ?? ""}
            maxLength={500}
            rows={2}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          বিরূপ প্রতিক্রিয়া (AEFI)
          <textarea
            name="adverse_event"
            defaultValue={adverseEvent ?? ""}
            maxLength={500}
            rows={2}
            className="mt-1 w-full rounded-md border border-[var(--color-danger)]/40 bg-transparent px-2 py-1 text-sm"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary-fg)] disabled:opacity-60"
          >
            {pending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}
          </button>
          {state?.ok && !pending && (
            <span className="text-xs text-[var(--color-success)]">সংরক্ষিত</span>
          )}
          {state?.error && <span className="text-xs text-[var(--color-danger)]">{state.error}</span>}
        </div>
      </form>
    </details>
  );
}
