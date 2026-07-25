"use client";

import { useActionState } from "react";
import { FACILITY_TYPE_LABEL_BN } from "@/lib/locations";
import { SubmitButton } from "../../_components/ui";
import {
  addCatchmentAction,
  createFacilityAction,
  removeCatchmentAction,
  type FacilityState,
} from "../_actions";

type Option = { id: string; label: string; depth: number };

const TYPES = Object.keys(FACILITY_TYPE_LABEL_BN) as (keyof typeof FACILITY_TYPE_LABEL_BN)[];

export function CreateFacilityForm({ locations }: { locations: Option[] }) {
  const [state, create] = useActionState<FacilityState, FormData>(
    createFacilityAction,
    undefined,
  );

  return (
    <form action={create} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fac-name-bn" className="mb-1 block text-sm font-medium">
            নাম (বাংলা)
          </label>
          <input
            id="fac-name-bn"
            name="name_bn"
            required
            maxLength={160}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="fac-name-en" className="mb-1 block text-sm font-medium">
            নাম (English)
          </label>
          <input
            id="fac-name-en"
            name="name_en"
            required
            maxLength={160}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="fac-type" className="mb-1 block text-sm font-medium">
            ধরন
          </label>
          <select
            id="fac-type"
            name="type"
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {FACILITY_TYPE_LABEL_BN[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fac-location" className="mb-1 block text-sm font-medium">
            অবস্থান <span className="text-[var(--color-muted)]">(কোথায় আছে)</span>
          </label>
          <select
            id="fac-location"
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
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="is_store" className="h-4 w-4" />
          এই কেন্দ্রে টিকার মজুদ রাখা হয় (স্টোর)
        </label>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-[var(--color-success)]">{state.ok}</p>}

      <SubmitButton pendingLabel="যোগ হচ্ছে…">কেন্দ্র যোগ করুন</SubmitButton>
    </form>
  );
}

// Catchment editing is per facility, inline. A facility serving three wards is the normal
// case, not the exception, so adding one has to be two clicks rather than a separate screen.
export function CatchmentEditor({
  facilityId,
  locations,
}: {
  facilityId: string;
  locations: Option[];
}) {
  const [state, add] = useActionState<FacilityState, FormData>(addCatchmentAction, undefined);

  return (
    <form action={add} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="facility_id" value={facilityId} />
      <div className="min-w-[14rem] flex-1">
        <label htmlFor={`catch-${facilityId}`} className="mb-1 block text-xs font-medium">
          সেবা এলাকা যোগ করুন
        </label>
        <select
          id={`catch-${facilityId}`}
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
      <SubmitButton variant="ghost" pendingLabel="…">
        যোগ
      </SubmitButton>
      {state?.error && (
        <p role="alert" className="w-full text-xs text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function RemoveCatchmentButton({
  facilityId,
  locationId,
}: {
  facilityId: string;
  locationId: string;
}) {
  const [, remove] = useActionState<FacilityState, FormData>(removeCatchmentAction, undefined);

  return (
    <form action={remove} className="inline">
      <input type="hidden" name="facility_id" value={facilityId} />
      <input type="hidden" name="location_id" value={locationId} />
      <button
        type="submit"
        aria-label="সেবা এলাকা বাদ দিন"
        className="ml-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
      >
        ✕
      </button>
    </form>
  );
}
