"use client";

import { useActionState } from "react";
import { ConfirmButton, FormMessage } from "@/components/ui/kit";
import { voidDoseAction, type VoidState } from "../_actions";

// The correction path for a dose recorded against the wrong child, the wrong antigen or the
// wrong date. Placed on the row it corrects rather than behind a separate screen, because the
// person who spots the error is looking at the row.
export function VoidDose({ recordId, childId }: { recordId: string; childId: string }) {
  const [state, save] = useActionState<VoidState, FormData>(voidDoseAction, undefined);

  return (
    <form action={save} className="mt-2 flex flex-col gap-2 print:hidden">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="child_id" value={childId} />
      <input
        name="void_reason"
        required
        minLength={3}
        maxLength={300}
        placeholder="বাতিলের কারণ"
        className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs"
      />
      <ConfirmButton
        label="ডোজ বাতিল করুন"
        title="এই ডোজটি বাতিল করবেন?"
        body="রেকর্ডটি মুছে যাবে না — কে কখন কেন বাতিল করল তা সহ থেকে যাবে, কিন্তু কভারেজ ও ড্রপআউটের হিসাবে আর গণ্য হবে না, এবং ব্যাচের মজুদে বিপরীত সমন্বয় লেখা হবে। এরপর সঠিক ডোজটি নতুন করে নথিভুক্ত করা যাবে।"
        confirmLabel="বাতিল করুন"
      />
      <FormMessage error={state?.error} ok={state?.ok} />
    </form>
  );
}
