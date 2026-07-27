"use client";

import { useActionState } from "react";
import { adjustStockAction, editBatchAction, type ActionState } from "../../_actions";
import { SubmitButton } from "@/components/ui/kit";

const field = "rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <p className="text-sm text-[var(--color-danger)]">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-[var(--color-success)]">সংরক্ষণ হয়েছে।</p>;
  return null;
}

export function BatchEditForm({
  id,
  batchNumber,
  expiryDate,
  stockQuantity,
}: {
  id: string;
  batchNumber: string;
  expiryDate: string;
  stockQuantity: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(editBatchAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm">
        ব্যাচ নম্বর
        <input name="batch_number" defaultValue={batchNumber} required className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        মেয়াদের তারিখ
        <input
          name="expiry_date"
          type="date"
          defaultValue={expiryDate.slice(0, 10)}
          required
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        মজুদ পরিমাণ
        <input
          name="stock_quantity"
          type="number"
          min={0}
          defaultValue={stockQuantity}
          required
          className={field}
        />
      </label>
      <Feedback state={state} />
      <div>
        <SubmitButton pendingLabel="সংরক্ষণ হচ্ছে…">সংরক্ষণ করুন</SubmitButton>
      </div>
    </form>
  );
}

export function StockAdjustForm({ id }: { id: string }) {
  const [state, action] = useActionState<ActionState, FormData>(adjustStockAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm">
        পরিমাণ পরিবর্তন (নতুন মজুদ যোগে +, খরচে −)
        <input name="delta" type="number" placeholder="যেমন: -20 বা 100" required className={field} />
      </label>
      <Feedback state={state} />
      <div>
        <SubmitButton variant="ghost" pendingLabel="প্রয়োগ হচ্ছে…">
          প্রয়োগ করুন
        </SubmitButton>
      </div>
    </form>
  );
}
