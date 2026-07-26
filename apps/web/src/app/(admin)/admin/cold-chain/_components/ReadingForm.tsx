"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "../../_components/ui";
import { addReadingAction, type ColdChainState } from "../_actions";

export function ReadingForm({
  devices,
}: {
  devices: { id: string; label: string; min_c: number; max_c: number }[];
}) {
  const [state, save] = useActionState<ColdChainState, FormData>(addReadingAction, undefined);
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [temp, setTemp] = useState("");

  const device = devices.find((d) => d.id === deviceId);
  const value = temp === "" ? null : Number(temp);
  const outOfRange =
    device != null && value != null && !Number.isNaN(value) && (value < device.min_c || value > device.max_c);

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-xs text-[var(--color-muted)] md:col-span-2">
          যন্ত্র
          <select
            name="device_id"
            required
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id} className="text-black">
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          তাপমাত্রা (°C)
          <input
            type="number"
            name="temperature_c"
            step="0.1"
            required
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </label>
      </div>

      {outOfRange && device && (
        // The warning appears before the save, and it asks for the action rather than just
        // announcing the problem. A recorded excursion with no action taken beside it is the
        // single most common gap in a real temperature log.
        <div className="rounded-md border border-[var(--color-danger)] px-3 py-2">
          <p className="text-xs text-[var(--color-danger)]">
            এই রিডিং নির্ধারিত সীমার ({device.min_c}–{device.max_c} °C) বাইরে। টিকা সরানো,
            মেরামতের ব্যবস্থা বা ঊর্ধ্বতনকে জানানো — কী করা হলো তা নিচে লিখুন।
          </p>
        </div>
      )}

      <label className="text-xs text-[var(--color-muted)]">
        কী ব্যবস্থা নেওয়া হয়েছে {outOfRange && <span className="text-[var(--color-danger)]">*</span>}
        <input
          name="action_taken"
          maxLength={300}
          required={outOfRange}
          placeholder={outOfRange ? "যেমন: টিকা পাশের কেন্দ্রে সরানো হয়েছে" : "ঐচ্ছিক"}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <FormMessage error={state?.error} ok={state?.ok} />
      <div>
        <SubmitButton variant={outOfRange ? "danger" : "primary"} pendingLabel="সংরক্ষণ হচ্ছে…">
          রেকর্ড করুন
        </SubmitButton>
      </div>
    </form>
  );
}
