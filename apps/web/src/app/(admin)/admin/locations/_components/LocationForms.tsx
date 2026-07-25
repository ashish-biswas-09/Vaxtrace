"use client";

import { useActionState, useState } from "react";
import { LEVEL_LABEL_BN, type LocationLevel } from "@/lib/locations";
import { SubmitButton } from "../../_components/ui";
import { createLocationAction, type GeoState } from "../_actions";

type Option = { id: string; label: string; depth: number; level: LocationLevel };

// The level a new node may take is decided by its parent, not chosen freely — and the rural
// and urban branches diverge at the same depth. Encoding the legal children of each level
// stops the picker from offering "union under city_corporation", which is the modelling error
// the whole location_level design exists to prevent.
const CHILD_LEVELS: Record<LocationLevel, LocationLevel[]> = {
  country: ["division"],
  division: ["district"],
  district: ["upazila", "city_corporation"],
  upazila: ["union"],
  city_corporation: ["urban_ward"],
  union: ["ward"],
  urban_ward: ["mahalla"],
  ward: ["village"],
  village: [],
  mahalla: [],
};

export function CreateLocationForm({ options }: { options: Option[] }) {
  const [state, create] = useActionState<GeoState, FormData>(createLocationAction, undefined);
  const [parentId, setParentId] = useState(options[0]?.id ?? "");

  const parent = options.find((o) => o.id === parentId);
  const allowed = parent ? CHILD_LEVELS[parent.level] : [];

  return (
    <form action={create} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="loc-parent" className="mb-1 block text-sm font-medium">
            মূল এলাকা
          </label>
          <select
            id="loc-parent"
            name="parent_id"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {" ".repeat(o.depth * 2)}
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="loc-level" className="mb-1 block text-sm font-medium">
            স্তর
          </label>
          <select
            id="loc-level"
            name="level"
            disabled={allowed.length === 0}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm disabled:opacity-60"
          >
            {allowed.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL_BN[l]}
              </option>
            ))}
          </select>
          {allowed.length === 0 && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              এই স্তরের নিচে আর কোনো স্তর নেই।
            </p>
          )}
        </div>

        <div>
          <label htmlFor="loc-slug" className="mb-1 block text-sm font-medium">
            স্লাগ <span className="text-[var(--color-muted)]">(ইংরেজি, অপরিবর্তনীয়)</span>
          </label>
          <input
            id="loc-slug"
            name="slug"
            required
            pattern="[a-z0-9_]+"
            placeholder="mouchak"
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 font-mono text-sm"
          />
        </div>

        <div>
          <label htmlFor="loc-name-bn" className="mb-1 block text-sm font-medium">
            নাম (বাংলা)
          </label>
          <input
            id="loc-name-bn"
            name="name_bn"
            required
            maxLength={120}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="loc-name-en" className="mb-1 block text-sm font-medium">
            নাম (English)
          </label>
          <input
            id="loc-name-en"
            name="name_en"
            required
            maxLength={120}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="loc-geo" className="mb-1 block text-sm font-medium">
            জিও-কোড <span className="text-[var(--color-muted)]">(BBS, ঐচ্ছিক)</span>
          </label>
          <input
            id="loc-geo"
            name="geo_code"
            maxLength={30}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 font-mono text-sm"
          />
          {/* A guessed geocode joins silently to the wrong census row; a blank one does not. */}
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            নিশ্চিত না হলে খালি রাখুন — ভুল কোড আদমশুমারির ভুল সারিতে যুক্ত হয়।
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="is_urban" className="h-4 w-4" />
          শহর এলাকা
        </label>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-[var(--color-success)]">{state.ok}</p>}

      <SubmitButton pendingLabel="যোগ হচ্ছে…">এলাকা যোগ করুন</SubmitButton>
    </form>
  );
}
