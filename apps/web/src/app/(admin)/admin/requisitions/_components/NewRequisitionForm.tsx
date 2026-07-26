"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "../../_components/ui";
import { createRequisitionAction, type RequisitionState } from "../_actions";

export function NewRequisitionForm({
  facilities,
  vaccines,
  today,
}: {
  facilities: { id: string; label: string; is_store: boolean }[];
  vaccines: { id: string; label: string }[];
  today: string;
}) {
  const [state, save] = useActionState<RequisitionState, FormData>(
    createRequisitionAction,
    undefined,
  );

  // Only facilities flagged as stores can supply. Offering every facility would let a
  // community clinic be asked to issue vaccine it has no ledger for.
  const stores = facilities.filter((f) => f.is_store);

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-[var(--color-muted)]">
          চাহিদাকারী কেন্দ্র
          <select
            name="from_facility_id"
            required
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="" className="text-black">
              নির্বাচন করুন…
            </option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id} className="text-black">
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          সরবরাহকারী গুদাম
          <select
            name="to_facility_id"
            required
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="" className="text-black">
              নির্বাচন করুন…
            </option>
            {stores.map((f) => (
              <option key={f.id} value={f.id} className="text-black">
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-[var(--color-muted)]">
          টিকা
          <select
            name="vaccine_id"
            required
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="" className="text-black">
              নির্বাচন করুন…
            </option>
            {vaccines.map((v) => (
              <option key={v.id} value={v.id} className="text-black">
                {v.label}
              </option>
            ))}
          </select>
        </label>
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
        <label className="text-xs text-[var(--color-muted)]">
          কবে প্রয়োজন
          <input
            type="date"
            name="needed_by"
            required
            min={today}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="text-xs text-[var(--color-muted)]">
        মন্তব্য
        <input
          name="note"
          maxLength={300}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <FormMessage error={state?.error} ok={state?.ok} />
      <div>
        <SubmitButton pendingLabel="জমা হচ্ছে…">চাহিদাপত্র জমা দিন</SubmitButton>
      </div>
    </form>
  );
}
