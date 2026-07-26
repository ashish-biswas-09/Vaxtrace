"use client";

import { useActionState } from "react";
import { SubmitButton } from "../../../(admin)/admin/_components/ui";
import { setWorkingAreaAction, type ScopeState } from "../_actions";

type Option = {
  id: string;
  roleLabel: string;
  area: string;
  facility: string | null;
  until: string | null;
};

export function WorkingAreaForm({
  options,
  current,
}: {
  options: Option[];
  current: string | null;
}) {
  const [state, save] = useActionState<ScopeState, FormData>(setWorkingAreaAction, undefined);

  return (
    <form action={save} className="flex w-full max-w-lg flex-col gap-3">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">কর্মএলাকা</legend>
        {options.map((o, i) => (
          <label
            key={`${o.id}-${i}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-border)] p-4 has-[:checked]:border-[var(--color-primary)]"
          >
            <input
              type="radio"
              name="location_id"
              value={o.id}
              defaultChecked={current ? o.id === current : i === 0}
              className="mt-1 h-4 w-4"
            />
            <span className="flex-1">
              <span className="block font-medium">{o.area}</span>
              <span className="block text-sm text-[var(--color-muted)]">
                {o.roleLabel}
                {o.facility && ` · ${o.facility}`}
              </span>
              {o.until && (
                <span className="mt-1 block text-xs text-[var(--color-warning)]">
                  মেয়াদ {o.until} পর্যন্ত
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="সংরক্ষণ হচ্ছে…">এই এলাকায় কাজ শুরু করুন</SubmitButton>
    </form>
  );
}
