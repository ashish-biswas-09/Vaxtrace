"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Two-factor authentication (SEC-03 / FR-08).
//
// Enrolment is a two-step handshake and both steps live here rather than in the browser: the
// TOTP secret is returned by the first call, and a secret that never crosses into client
// JavaScript is a secret that cannot end up in a browser extension, a screenshotting tool, or
// a client-side error report. Only the QR image and the code the user types move through the
// component.

export type EnrollState =
  | { factorId: string; qr: string; secret: string; error?: undefined }
  | { error: string; factorId?: undefined; qr?: undefined; secret?: undefined }
  | undefined;

export type VerifyState = { error?: string; ok?: string } | undefined;

export async function startEnrollAction(): Promise<EnrollState> {
  const { supabase } = await requireUser();

  // A half-finished enrolment leaves an unverified factor behind, and a second attempt then
  // fails on the friendly-name uniqueness constraint. Clearing them first makes "try again"
  // actually work instead of failing with a message about a factor the user never saw.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const factor of existing?.all ?? []) {
    if (factor.status !== "verified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "VaxTrace",
  });
  if (error || !data) {
    return { error: "দুই-ধাপ যাচাই চালু করা যায়নি — আবার চেষ্টা করুন।" };
  }

  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

const verifySchema = z.object({
  factor_id: z.string().min(1),
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "৬ সংখ্যার কোড লিখুন"),
});

export async function verifyEnrollAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const parsed = verifySchema.safeParse({
    factor_id: formData.get("factor_id"),
    // The code is typed off a phone, and a Bangla keyboard produces Bengali digits. Normalise
    // before validating, or a correct code is rejected as malformed.
    code: normaliseDigits(String(formData.get("code") ?? "")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "কোড সঠিক নয়" };
  }

  const { supabase } = await requireUser();

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: parsed.data.factor_id,
  });
  if (challengeError || !challenge) return { error: "যাচাই শুরু করা যায়নি।" };

  const { error } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factor_id,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  // A wrong code is the common case and says nothing about the account, so it gets the plain
  // message. Anything else is reported the same way: an attacker learns nothing from either.
  if (error) return { error: "কোডটি মেলেনি — আবার চেষ্টা করুন।" };

  // verify() re-issues the session at aal2. The cookie write happens through the SSR client's
  // setAll, so the next request — and every RLS policy calling mfa_satisfied() — sees it.
  revalidatePath("/account/security");
  revalidatePath("/admin", "layout");
  return { ok: "দুই-ধাপ যাচাই চালু হয়েছে।" };
}

const disableSchema = z.object({ factor_id: z.string().min(1) });

// Removing the second factor is itself a privileged act, so it requires a current code. A
// session that walked away unlocked must not be enough to strip the protection off the
// account it is sitting in front of.
export async function disableMfaAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const parsed = disableSchema
    .extend({ code: z.string().trim().regex(/^[0-9]{6}$/, "৬ সংখ্যার কোড লিখুন") })
    .safeParse({
      factor_id: formData.get("factor_id"),
      code: normaliseDigits(String(formData.get("code") ?? "")),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "কোড সঠিক নয়" };
  }

  const { supabase } = await requireUser();

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: parsed.data.factor_id,
  });
  if (challengeError || !challenge) return { error: "যাচাই শুরু করা যায়নি।" };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factor_id,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (verifyError) return { error: "কোডটি মেলেনি।" };

  const { error } = await supabase.auth.mfa.unenroll({ factorId: parsed.data.factor_id });
  if (error) return { error: "বন্ধ করা যায়নি।" };

  revalidatePath("/account/security");
  return { ok: "দুই-ধাপ যাচাই বন্ধ হয়েছে।" };
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
function normaliseDigits(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}
