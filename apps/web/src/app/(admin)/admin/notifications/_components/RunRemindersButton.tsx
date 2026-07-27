"use client";

import { useActionState } from "react";
import { ConfirmButton, FormMessage } from "@/components/ui/kit";
import { runRemindersAction, type RunState } from "../_actions";

// Privileged trigger, so it asks first (audit UX-02). The action is idempotent, but a confirm
// is still right: the operator should know they are queueing messages to real guardians.
//
// ConfirmButton rather than window.confirm — the browser dialog had one line and no styling,
// so it could not say that the queue also runs nightly on its own, which is the context that
// decides whether pressing this is necessary at all.
export function RunRemindersButton() {
  const [state, action] = useActionState<RunState, FormData>(
    () => runRemindersAction(),
    undefined,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={action}>
        <ConfirmButton
          label="এখনই সারি তৈরি করুন"
          title="এখনই রিমাইন্ডার সারি তৈরি করবেন?"
          body="আজ যাদের ডোজ দেয় আছে, তাদের অভিভাবকদের জন্য বার্তা সারিবদ্ধ হবে। সারি প্রতি রাতে স্বয়ংক্রিয়ভাবেও তৈরি হয়, তাই সাধারণত এটি চাপার দরকার হয় না। একই দিনে একই ডোজের জন্য দুবার সারিবদ্ধ হয় না।"
          confirmLabel="সারি তৈরি করুন"
          variant="primary"
        />
      </form>
      <FormMessage error={state?.error} ok={state?.ok} />
    </div>
  );
}
