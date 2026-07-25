"use client";

import { useActionState } from "react";
import { registerChildAction, type RegisterState } from "../_actions";

const field =
  "mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

export type GuardianOption = { id: string; full_name: string; contact: string | null };

export function RegisterChildForm({
  guardians,
  today,
}: {
  guardians: GuardianOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerChildAction,
    undefined,
  );

  if (guardians.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--color-warning)] px-4 py-3 text-sm">
        কোনো অভিভাবক অ্যাকাউন্ট নেই। শিশু নিবন্ধনের আগে অভিভাবককে অ্যাকাউন্ট খুলতে হবে — তিনি নিজে
        সাইন আপ করতে পারেন, অথবা অ্যাডমিন আমন্ত্রণ পাঠাতে পারেন।
      </p>
    );
  }

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <label className="text-xs text-[var(--color-muted)]">
        শিশুর পূর্ণ নাম
        <input name="full_name" required maxLength={120} className={field} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-xs text-[var(--color-muted)]">
          জন্মতারিখ
          {/* Native date input: `max` stops a future date in the browser, and the action and
              the CHECK constraint stop it again server-side. */}
          <input name="date_of_birth" type="date" max={today} required className={field} />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          লিঙ্গ
          <select name="gender" defaultValue="male" className={field}>
            <option value="male" className="text-black">
              ছেলে
            </option>
            <option value="female" className="text-black">
              মেয়ে
            </option>
            <option value="other" className="text-black">
              অন্যান্য
            </option>
          </select>
        </label>
      </div>

      <label className="text-xs text-[var(--color-muted)]">
        অভিভাবক
        <select name="guardian_id" required defaultValue="" className={field}>
          <option value="" disabled className="text-black">
            নির্বাচন করুন
          </option>
          {guardians.map((g) => (
            <option key={g.id} value={g.id} className="text-black">
              {g.full_name}
              {g.contact ? ` — ${g.contact}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[var(--color-muted)]">
        যোগাযোগ নম্বর (ঐচ্ছিক)
        <input
          name="guardian_contact"
          inputMode="tel"
          placeholder="+8801XXXXXXXXX"
          maxLength={120}
          className={field}
        />
        <span className="mt-1 block">
          ফাঁকা রাখলে অভিভাবকের প্রোফাইলের নম্বর ব্যবহৃত হবে। রিমাইন্ডার এই নম্বরে যাবে।
        </span>
      </label>

      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-border)]/20 px-3 py-2 text-xs text-[var(--color-muted)]">
        নিবন্ধনের সাথে সাথেই ১০-সংখ্যার <strong>শিশু আইডি</strong> তৈরি হবে এবং জন্মতারিখ থেকে
        সম্পূর্ণ টিকার সূচি স্বয়ংক্রিয়ভাবে তৈরি হবে।
      </p>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] disabled:opacity-60"
        >
          {pending ? "নিবন্ধন হচ্ছে…" : "শিশু নিবন্ধন করুন"}
        </button>
      </div>
    </form>
  );
}
