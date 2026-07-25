"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createBatchAction, type ActionState } from "../../_actions";
import { SubmitButton } from "../../../_components/ui";

const field = "rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

export function NewBatchForm({ vaccines }: { vaccines: { id: string; name_bn: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createBatchAction, undefined);
  const router = useRouter();

  // Return to the list once the batch exists — staying on an empty form after a successful
  // save leaves the operator unsure whether it went in.
  useEffect(() => {
    if (state?.ok) router.push("/admin/inventory");
  }, [state, router]);

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        টিকা
        <select name="vaccine_id" required defaultValue="" className={field}>
          <option value="" disabled className="text-black">
            নির্বাচন করুন
          </option>
          {vaccines.map((v) => (
            <option key={v.id} value={v.id} className="text-black">
              {v.name_bn}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ব্যাচ নম্বর
        <input name="batch_number" required maxLength={64} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        মেয়াদের তারিখ
        <input name="expiry_date" type="date" required className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        প্রাপ্ত পরিমাণ
        <input name="stock_quantity" type="number" min={0} defaultValue={0} required className={field} />
      </label>
      {state?.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      <div>
        <SubmitButton pendingLabel="যোগ হচ্ছে…">ব্যাচ যোগ করুন</SubmitButton>
      </div>
    </form>
  );
}
