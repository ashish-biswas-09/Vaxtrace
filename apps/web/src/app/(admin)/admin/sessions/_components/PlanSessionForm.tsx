"use client";

import { useActionState, useState } from "react";
import type { Database } from "@vaxtrace/db-types";
import { SESSION_TYPE_BN } from "@/lib/programme";
import { FormMessage, SubmitButton } from "../../_components/ui";
import { planSessionAction, type SessionState } from "../_actions";

type SessionType = Database["public"]["Enums"]["session_type"];

export function PlanSessionForm({
  facilities,
  locations,
  staff,
  today,
}: {
  facilities: { id: string; label: string; location_id: string }[];
  locations: { id: string; depth: number; label: string }[];
  staff: { id: string; name: string }[];
  today: string;
}) {
  const [state, save] = useActionState<SessionState, FormData>(planSessionAction, undefined);
  const [type, setType] = useState<SessionType>("fixed");
  const [facility, setFacility] = useState("");
  const [location, setLocation] = useState("");

  // For a fixed session the two are the same place, so picking the facility fills the area and
  // the planner does not have to know the answer twice. For outreach they genuinely differ, so
  // the field is left alone and the caption says why.
  const onFacility = (id: string) => {
    setFacility(id);
    if (type === "fixed") {
      setLocation(facilities.find((f) => f.id === id)?.location_id ?? "");
    }
  };

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-[var(--color-muted)]">
          ধরন
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as SessionType)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {(Object.keys(SESSION_TYPE_BN) as SessionType[]).map((t) => (
              <option key={t} value={t} className="text-black">
                {SESSION_TYPE_BN[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          সেবা কেন্দ্র (কে চালাচ্ছে)
          <select
            name="facility_id"
            required
            value={facility}
            onChange={(e) => onFacility(e.target.value)}
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
          এলাকা (কোথায় হচ্ছে)
          <select
            name="location_id"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="" className="text-black">
              নির্বাচন করুন…
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id} className="text-black">
                {" ".repeat(l.depth * 2)}
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="text-xs text-[var(--color-muted)]">
          তারিখ
          <input
            type="date"
            name="session_date"
            required
            min={today}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          শুরু
          <input
            type="time"
            name="start_time"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          শেষ
          <input
            type="time"
            name="end_time"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          লক্ষ্য শিশু
          <input
            type="number"
            name="target_children"
            min={0}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs text-[var(--color-muted)]">
          দলনেতা
          <select
            name="team_lead"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="" className="text-black">
              পরে নির্ধারণ করা হবে
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id} className="text-black">
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          মন্তব্য
          <input
            name="notes"
            maxLength={400}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      <FormMessage error={state?.error} ok={state?.ok} />
      <div>
        <SubmitButton pendingLabel="সংরক্ষণ হচ্ছে…">সেশন পরিকল্পনা করুন</SubmitButton>
      </div>
    </form>
  );
}
