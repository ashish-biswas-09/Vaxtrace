"use client";

import { useActionState, useState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { DEVICE_KIND_BN } from "@/lib/programme";
import { FormMessage, SubmitButton } from "../../_components/ui";
import { addDeviceAction, type ColdChainState } from "../_actions";

type Kind = Database["public"]["Enums"]["cold_chain_device_kind"];

// The ranges a store keeper should not have to remember. They are defaults on a form, not
// constants in a view — an unusual device can still be given its own range.
const DEFAULT_RANGE: Record<Kind, { min: number; max: number }> = {
  ilr: { min: 2, max: 8 },
  deep_freezer: { min: -25, max: -15 },
  vaccine_carrier: { min: 2, max: 8 },
  cold_box: { min: 2, max: 8 },
  walk_in_cooler: { min: 2, max: 8 },
};

export function AddDeviceForm({ facilities }: { facilities: { id: string; label: string }[] }) {
  const [state, save] = useActionState<ColdChainState, FormData>(addDeviceAction, undefined);
  const [kind, setKind] = useState<Kind>("ilr");

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-[var(--color-muted)]">
          কেন্দ্র
          <select
            name="facility_id"
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
          যন্ত্রের নাম
          <input
            name="name"
            required
            maxLength={80}
            placeholder="যেমন: ILR-১"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-[var(--color-muted)]">
          ধরন
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {(Object.keys(DEVICE_KIND_BN) as Kind[]).map((k) => (
              <option key={k} value={k} className="text-black">
                {DEVICE_KIND_BN[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          সর্বনিম্ন (°C)
          <input
            type="number"
            name="min_c"
            step="0.1"
            required
            // `key` forces React to re-mount the input when the kind changes, so a
            // defaultValue actually updates. Making it fully controlled would stop the store
            // keeper from typing an unusual range at all.
            key={`min-${kind}`}
            defaultValue={DEFAULT_RANGE[kind].min}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          সর্বোচ্চ (°C)
          <input
            type="number"
            name="max_c"
            step="0.1"
            required
            key={`max-${kind}`}
            defaultValue={DEFAULT_RANGE[kind].max}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      <FormMessage error={state?.error} ok={state?.ok} />
      <div>
        <SubmitButton pendingLabel="যোগ হচ্ছে…">যন্ত্র যোগ করুন</SubmitButton>
      </div>
    </form>
  );
}
