"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/kit";
import { upsertPopulationAction, type PopulationState } from "../_actions";
import { AGE_BANDS } from "./age-bands";

type Option = { id: string; label: string; depth: number };

export function PopulationForm({
  locations,
  defaultYear,
}: {
  locations: Option[];
  defaultYear: number;
}) {
  const [state, save] = useActionState<PopulationState, FormData>(
    upsertPopulationAction,
    undefined,
  );

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="pop-location" className="mb-1 block text-sm font-medium">
            এলাকা
          </label>
          <select
            id="pop-location"
            name="location_id"
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {locations.map((o) => (
              <option key={o.id} value={o.id}>
                {" ".repeat(o.depth * 2)}
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pop-year" className="mb-1 block text-sm font-medium">
            বছর
          </label>
          <input
            id="pop-year"
            name="year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={defaultYear}
            required
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="pop-band" className="mb-1 block text-sm font-medium">
            বয়স শ্রেণি
          </label>
          <select
            id="pop-band"
            name="age_band"
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {AGE_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
                {b.hint && ` — ${b.hint}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pop-estimate" className="mb-1 block text-sm font-medium">
            আনুমানিক সংখ্যা
          </label>
          <input
            id="pop-estimate"
            name="estimate"
            type="number"
            min={0}
            required
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="pop-source" className="mb-1 block text-sm font-medium">
            উৎস
          </label>
          <input
            id="pop-source"
            name="source"
            required
            maxLength={160}
            placeholder="BBS আদমশুমারি ২০২২"
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-[var(--color-success)]">{state.ok}</p>}

      <SubmitButton pendingLabel="সংরক্ষণ হচ্ছে…">সংরক্ষণ করুন</SubmitButton>
    </form>
  );
}
