"use client";

import { useActionState, useState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { MANUAL_TXN_TYPES, STOCK_TXN_BN, WASTAGE_REASON_BN } from "@/lib/programme";
import { ConfirmButton, FormMessage, SubmitButton } from "../../_components/ui";
import { recordMovementAction, type StockState } from "../_actions";

type TxnType = Database["public"]["Enums"]["stock_txn_type"];
type Reason = Database["public"]["Enums"]["wastage_reason"];

export function MovementForm({
  batches,
  today,
}: {
  batches: { id: string; label: string; expiry: string; quantity: number; vaccine_id: string }[];
  today: string;
}) {
  const [state, save] = useActionState<StockState, FormData>(recordMovementAction, undefined);
  const [type, setType] = useState<TxnType>("receipt");
  const [batchId, setBatchId] = useState("");

  const batch = batches.find((b) => b.id === batchId);

  // FEFO, surfaced rather than enforced: the batch that should be opened next is the one that
  // expires first among those with stock. The store keeper can see the shelf and this cannot,
  // so it is a prompt, not a rule.
  const fefo = batch
    ? batches
        .filter((b) => b.vaccine_id === batch.vaccine_id && b.quantity > 0 && b.expiry >= today)
        .sort((a, b) => a.expiry.localeCompare(b.expiry))[0]
    : null;
  const notFefo = Boolean(fefo && batch && fefo.id !== batch.id && batch.quantity > 0);

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-[var(--color-muted)]">
          ব্যাচ
          <select
            name="inventory_id"
            required
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="" className="text-black">
              নির্বাচন করুন…
            </option>
            {batches.map((b) => (
              <option key={b.id} value={b.id} className="text-black">
                {b.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          লেনদেনের ধরন
          <select
            name="txn_type"
            value={type}
            onChange={(e) => setType(e.target.value as TxnType)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {MANUAL_TXN_TYPES.map((t) => (
              <option key={t} value={t} className="text-black">
                {STOCK_TXN_BN[t].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notFefo && fefo && (
        <p className="rounded-md border border-[var(--color-warning)] px-3 py-2 text-xs text-[var(--color-warning)]">
          আগে মেয়াদ শেষ হবে এমন একটি ব্যাচ মজুদে আছে: <strong>{fefo.label}</strong>। আগে সেটি
          ব্যবহার করলে মেয়াদোত্তীর্ণ হয়ে নষ্ট হওয়ার পরিমাণ কমে।
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-[var(--color-muted)]">
          ডোজ সংখ্যা
          <input
            type="number"
            name="quantity"
            min={1}
            required
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>

        {type === "wastage" && (
          <label className="text-xs text-[var(--color-muted)]">
            অপচয়ের কারণ
            <select
              name="reason"
              required
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            >
              {(Object.keys(WASTAGE_REASON_BN) as Reason[]).map((r) => (
                <option key={r} value={r} className="text-black">
                  {WASTAGE_REASON_BN[r]}
                </option>
              ))}
            </select>
          </label>
        )}

        {type === "adjustment" && (
          <label className="text-xs text-[var(--color-muted)]">
            দিক
            <select
              name="direction"
              defaultValue="in"
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            >
              <option value="in" className="text-black">
                মজুদ বাড়াতে (গণনায় বেশি পাওয়া গেছে)
              </option>
              <option value="out" className="text-black">
                মজুদ কমাতে (গণনায় কম পাওয়া গেছে)
              </option>
            </select>
          </label>
        )}

        <label className="text-xs text-[var(--color-muted)]">
          ব্যাখ্যা {type === "adjustment" && <span className="text-[var(--color-danger)]">*</span>}
          <input
            name="note"
            maxLength={300}
            required={type === "adjustment"}
            placeholder={type === "adjustment" ? "কেন হিসাব মেলেনি" : "ঐচ্ছিক"}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      <FormMessage error={state?.error} ok={state?.ok} />

      <div>
        {/* UX-05: a receipt is additive and reversible by an adjustment, so it goes straight
            through. Wastage and adjustment change a balance that a report will be built on and
            cannot be edited afterwards, so they stop for a confirmation. */}
        {type === "receipt" ? (
          <SubmitButton pendingLabel="সংরক্ষণ হচ্ছে…">গ্রহণ লিখুন</SubmitButton>
        ) : (
          <ConfirmButton
            label={type === "wastage" ? "অপচয় লিখুন" : "সমন্বয় লিখুন"}
            title={type === "wastage" ? "অপচয় নথিভুক্ত করবেন?" : "মজুদ সমন্বয় করবেন?"}
            body={
              type === "wastage"
                ? "এই ডোজগুলো মজুদ থেকে বাদ যাবে এবং অপচয়ের হারে যোগ হবে। লেজারের সারি পরে সম্পাদনা বা মোছা যায় না — ভুল হলে বিপরীত সমন্বয় লিখতে হবে।"
                : "শারীরিক গণনার সঙ্গে হিসাব মেলাতে এই সমন্বয় লেজারে যোগ হবে। সমন্বয় নিরীক্ষায় প্রথম যে সারিগুলো পড়া হয়, তাই ব্যাখ্যাটি স্পষ্ট রাখুন।"
            }
            confirmLabel="নিশ্চিত করুন"
          />
        )}
      </div>
    </form>
  );
}
