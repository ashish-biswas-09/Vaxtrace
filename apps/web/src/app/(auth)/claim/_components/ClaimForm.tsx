"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/kit";
import { claimChildAction, type ClaimState } from "../_actions";

export function ClaimForm() {
  const [state, claim] = useActionState<ClaimState, FormData>(claimChildAction, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="rounded-md border border-[var(--color-success)] px-4 py-3 text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
        <Link
          href="/parent"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
        >
          টিকার তথ্য দেখুন
        </Link>
      </div>
    );
  }

  return (
    <form action={claim} className="flex w-full max-w-sm flex-col gap-4">
      <label htmlFor="claim-child-id" className="flex flex-col gap-1 text-sm">
        শিশু আইডি
        <input
          id="claim-child-id"
          name="child_id"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="১০ সংখ্যার আইডি"
          className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-center font-mono text-lg tracking-widest"
        />
      </label>

      <p className="text-xs text-[var(--color-muted)]">
        টিকা কার্ডে লেখা ১০ সংখ্যার আইডিটি লিখুন। যে ফোন নম্বরটি স্বাস্থ্যকর্মী নিবন্ধনের সময়
        লিখেছিলেন, সেই নম্বর দিয়েই প্রবেশ করতে হবে।
      </p>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="যুক্ত হচ্ছে…">শিশুকে যুক্ত করুন</SubmitButton>
    </form>
  );
}
