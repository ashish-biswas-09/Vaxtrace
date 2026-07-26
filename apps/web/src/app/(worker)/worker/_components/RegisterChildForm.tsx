"use client";

import { useActionState, useState } from "react";
import { RELATIONSHIP_LABEL_BN, hasUsablePhone } from "@/lib/guardians";
import { registerChildAction, type RegisterState } from "../_actions";

const field =
  "mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

export type GuardianOption = {
  id: string;
  full_name: string;
  phone: string;
};

export type AreaOption = { id: string; label: string; depth: number };

const RELATIONSHIPS = Object.keys(RELATIONSHIP_LABEL_BN) as (keyof typeof RELATIONSHIP_LABEL_BN)[];

export function RegisterChildForm({
  guardians,
  areas,
  today,
  defaultAreaId,
}: {
  guardians: GuardianOption[];
  areas: AreaOption[];
  today: string;
  defaultAreaId: string | null;
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerChildAction,
    undefined,
  );
  // Existing guardian or a new one. New is the fallback when no guardian records exist yet;
  // in the field the guardian standing in front of the worker usually has no record.
  const [mode, setMode] = useState<"new" | "existing">(
    guardians.length > 0 ? "existing" : "new",
  );

  const duplicates = state?.duplicates ?? [];

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      {duplicates.length > 0 && (
        // FR-16. Shown, not blocked: twins share a surname, a date of birth and a phone
        // number, and a worker who cannot register the second twin will register them as
        // something else. The absence of this check is what manufactures duplicates.
        <section className="rounded-lg border border-[var(--color-warning)] p-4">
          <h2 className="text-sm font-semibold text-[var(--color-warning)]">
            মিল পাওয়া গেছে — শিশুটি ইতিমধ্যে নিবন্ধিত হতে পারে
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {duplicates.map((d) => (
              <li key={d.id} className="rounded-md border border-[var(--color-border)] p-3">
                <span className="font-medium">{d.full_name}</span>
                <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">
                  {d.child_id}
                </span>
                <span className="mt-1 block text-xs text-[var(--color-muted)]">
                  অভিভাবক: {d.guardian_name} · {d.reason}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            উপরের কোনোটি এই শিশু হলে নতুন নিবন্ধন করবেন না — তালিকা থেকে শিশুটি খুঁজে নিন।
          </p>
          <button
            type="submit"
            name="confirmed_new"
            value="1"
            className="mt-3 rounded-md border border-[var(--color-warning)] px-4 py-2 text-sm font-medium text-[var(--color-warning)]"
          >
            না, এটি নতুন শিশু — নিবন্ধন করুন
          </button>
        </section>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">শিশুর তথ্য</legend>

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
          এলাকা (ওয়ার্ড / গ্রাম)
          <select
            name="location_id"
            required
            defaultValue={defaultAreaId ?? ""}
            className={field}
          >
            <option value="" disabled className="text-black">
              নির্বাচন করুন
            </option>
            {areas.map((a) => (
              <option key={a.id} value={a.id} className="text-black">
                {" ".repeat(a.depth * 2)}
                {a.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block">
            শিশুটি কোন এলাকার — এর উপরেই কভারেজ রিপোর্ট ও ডিফল্টার তালিকা তৈরি হয়।
          </span>
        </label>

        <label className="text-xs text-[var(--color-muted)]">
          জন্ম নিবন্ধন নম্বর (ঐচ্ছিক)
          <input
            name="birth_registration_no"
            inputMode="numeric"
            maxLength={20}
            className={field}
          />
          {/* Never a prerequisite: birth-registration coverage is incomplete and many
              children have no BRN at first contact (report §8.3). */}
          <span className="mt-1 block">না থাকলে ফাঁকা রাখুন — পরে যোগ করা যাবে।</span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">অভিভাবক</legend>

        {guardians.length > 0 && (
          <div className="flex rounded-lg border border-[var(--color-border)] p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 rounded-md py-2 ${mode === "existing" ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : ""}`}
            >
              তালিকা থেকে
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 rounded-md py-2 ${mode === "new" ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : ""}`}
            >
              নতুন অভিভাবক
            </button>
          </div>
        )}

        {mode === "existing" && guardians.length > 0 ? (
          <label className="text-xs text-[var(--color-muted)]">
            অভিভাবক নির্বাচন
            <select name="guardian_id" defaultValue="" className={field}>
              <option value="" disabled className="text-black">
                নির্বাচন করুন
              </option>
              {guardians.map((g) => (
                <option key={g.id} value={g.id} className="text-black">
                  {g.full_name}
                  {hasUsablePhone(g.phone) ? ` — ${g.phone}` : " — নম্বর নেই"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            {/* No account is created here. A guardian is a domain record — name, phone,
                relationship — and the account, if it ever exists, is claimed later with the
                Child ID (FR-15). That is what lets a worker register a child from a guardian
                with no smartphone, which is most of them. */}
            <input type="hidden" name="guardian_id" value="" />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-[var(--color-muted)]">
                অভিভাবকের নাম
                <input name="guardian_name" maxLength={120} className={field} />
              </label>
              <label className="text-xs text-[var(--color-muted)]">
                ফোন নম্বর
                <input
                  name="guardian_phone"
                  inputMode="tel"
                  placeholder="+8801XXXXXXXXX"
                  maxLength={20}
                  className={field}
                />
              </label>
            </div>
            <label className="text-xs text-[var(--color-muted)]">
              সম্পর্ক
              <select name="guardian_relationship" defaultValue="mother" className={field}>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r} className="text-black">
                    {RELATIONSHIP_LABEL_BN[r]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-[var(--color-muted)]">
              অ্যাকাউন্ট খোলার প্রয়োজন নেই। অভিভাবক পরে শিশু আইডি দিয়ে নিজের অ্যাকাউন্টে শিশুটিকে
              যুক্ত করতে পারবেন।
            </p>
          </>
        )}
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}

      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-border)]/20 px-3 py-2 text-xs text-[var(--color-muted)]">
        নিবন্ধনের সাথে সাথেই ১০-সংখ্যার <strong>শিশু আইডি</strong> তৈরি হবে এবং জন্মতারিখ থেকে
        সম্পূর্ণ টিকার সূচি স্বয়ংক্রিয়ভাবে তৈরি হবে।
      </p>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] disabled:opacity-60"
      >
        {pending ? "নিবন্ধন হচ্ছে…" : "নিবন্ধন করুন"}
      </button>
    </form>
  );
}
