"use client";

import { useActionState } from "react";
import { toBn } from "@/lib/format";
import { updateSettingsAction, type SettingsState } from "../_actions";

export type ReminderSettings = {
  reminder_lead_days: number;
  daily_run_hour: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
  channel_sms: boolean;
  channel_email: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${toBn(String(h).padStart(2, "0"))}:০০`;

const select =
  "rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm";

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--color-muted)]">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Explicit Save with a dirty state, not auto-save (audit UX-11): these values change when
// reminders go out to real guardians, so a mis-click should not be the commit.
export function ReminderSettingsForm({ settings }: { settings: ReminderSettings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateSettingsAction,
    undefined,
  );

  return (
    <form action={action}>
      <Row label="রিমাইন্ডার লিড টাইম" desc="দেয় তারিখের কত দিন আগে সারিতে যাবে">
        <select name="reminder_lead_days" defaultValue={settings.reminder_lead_days} className={select}>
          {[0, 1, 2, 3, 5, 7, 10, 14, 30].map((d) => (
            <option key={d} value={d} className="text-black">
              {toBn(d)} দিন
            </option>
          ))}
        </select>
      </Row>

      <Row label="দৈনিক পাঠানোর সময়" desc="সারিবদ্ধ রিমাইন্ডার কখন পাঠানো হবে">
        <select name="daily_run_hour" defaultValue={settings.daily_run_hour} className={select}>
          {HOURS.map((h) => (
            <option key={h} value={h} className="text-black">
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </Row>

      <Row label="নীরব সময় শুরু" desc="এই সময়ের মধ্যে পড়লে পাঠানো পিছিয়ে যাবে">
        <select name="quiet_hours_start" defaultValue={settings.quiet_hours_start} className={select}>
          {HOURS.map((h) => (
            <option key={h} value={h} className="text-black">
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </Row>

      <Row label="নীরব সময় শেষ" desc="এই সময়ে নীরবতা উঠে যায়">
        <select name="quiet_hours_end" defaultValue={settings.quiet_hours_end} className={select}>
          {HOURS.map((h) => (
            <option key={h} value={h} className="text-black">
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </Row>

      <Row label="SMS চ্যানেল" desc="SMS গেটওয়ে দিয়ে রিমাইন্ডার সারিবদ্ধ হবে">
        <input
          type="checkbox"
          name="channel_sms"
          defaultChecked={settings.channel_sms}
          className="h-5 w-5 accent-[var(--color-primary)]"
          aria-label="SMS চ্যানেল সক্রিয়"
        />
      </Row>

      <Row label="ইমেইল চ্যানেল" desc="ইমেইলে রিমাইন্ডার সারিবদ্ধ হবে">
        <input
          type="checkbox"
          name="channel_email"
          defaultChecked={settings.channel_email}
          className="h-5 w-5 accent-[var(--color-primary)]"
          aria-label="ইমেইল চ্যানেল সক্রিয়"
        />
      </Row>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] px-4 py-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] disabled:opacity-60"
        >
          {pending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
        </button>
        {state?.ok && (
          <span role="status" className="text-xs text-[var(--color-success)]">
            {state.ok}
          </span>
        )}
        {state?.error && (
          <span role="alert" className="text-xs text-[var(--color-danger)]">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
