"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { SubmitButton } from "../../../../(admin)/admin/_components/ui";
import {
  disableMfaAction,
  startEnrollAction,
  verifyEnrollAction,
  type EnrollState,
  type VerifyState,
} from "../_actions";

// Enrolment is a three-state machine: nothing yet -> a QR to scan -> verified. Holding the
// enrolment payload in component state (rather than in the URL or in a cookie) means an
// abandoned enrolment leaves nothing behind but an unverified factor, which the next
// startEnrollAction clears.
export function MfaEnrollPanel() {
  const [enroll, setEnroll] = useState<EnrollState>(undefined);
  const [pending, setPending] = useState(false);
  const [verifyState, verify] = useActionState<VerifyState, FormData>(
    verifyEnrollAction,
    undefined,
  );

  if (verifyState?.ok) {
    return (
      <p className="rounded-md border border-[var(--color-success)] px-4 py-3 text-sm text-[var(--color-success)]">
        {verifyState.ok}
      </p>
    );
  }

  if (!enroll?.factorId) {
    return (
      <div className="flex flex-col gap-3">
        {enroll?.error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {enroll.error}
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setEnroll(await startEnrollAction());
            setPending(false);
          }}
          className="self-start rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] disabled:opacity-60"
        >
          {pending ? "শুরু হচ্ছে…" : "দুই-ধাপ যাচাই চালু করুন"}
        </button>
      </div>
    );
  }

  return (
    <form action={verify} className="flex flex-col gap-4">
      <input type="hidden" name="factor_id" value={enroll.factorId} />
      <ol className="flex flex-col gap-4 text-sm">
        <li>
          <p className="mb-2">১. আপনার ফোনের অথেনটিকেটর অ্যাপ দিয়ে এই QR কোডটি স্ক্যান করুন।</p>
          {/* The QR arrives as an SVG data URI from Supabase Auth; unoptimized because there
              is nothing for the image optimiser to fetch or cache. */}
          <Image
            src={enroll.qr}
            alt="দুই-ধাপ যাচাইয়ের QR কোড"
            width={180}
            height={180}
            unoptimized
            className="rounded-md border border-[var(--color-border)] bg-white p-2"
          />
        </li>
        <li>
          <p className="mb-1">২. স্ক্যান করতে না পারলে এই কোডটি হাতে লিখুন:</p>
          <code className="block rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-xs break-all">
            {enroll.secret}
          </code>
        </li>
        <li>
          <label htmlFor="mfa-code" className="mb-1 block">
            ৩. অ্যাপে দেখানো ৬ সংখ্যার কোডটি লিখুন:
          </label>
          <input
            id="mfa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className="w-40 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 font-mono tracking-widest"
          />
        </li>
      </ol>
      {verifyState?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {verifyState.error}
        </p>
      )}
      <SubmitButton pendingLabel="যাচাই হচ্ছে…">যাচাই করুন</SubmitButton>
    </form>
  );
}

export function MfaDisablePanel({ factorId }: { factorId: string }) {
  const [state, disable] = useActionState<VerifyState, FormData>(disableMfaAction, undefined);

  return (
    <form action={disable} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="factor_id" value={factorId} />
      <div>
        <label htmlFor="disable-code" className="mb-1 block text-sm">
          বন্ধ করতে বর্তমান কোড লিখুন
        </label>
        <input
          id="disable-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className="w-40 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 font-mono tracking-widest"
        />
      </div>
      <SubmitButton variant="danger" pendingLabel="বন্ধ হচ্ছে…">
        বন্ধ করুন
      </SubmitButton>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="w-full text-sm text-[var(--color-success)]">{state.ok}</p>
      )}
    </form>
  );
}
