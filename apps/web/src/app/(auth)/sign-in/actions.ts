"use server";

import { getUserRole, roleLandingPath } from "@/lib/auth";
import { createClient } from "@/server/supabase/server";
import { redirect } from "next/navigation";
import { otpRequestSchema, passwordSignInSchema } from "./schema";

export type SignInState = { error?: string } | undefined;

export async function signInAction(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = passwordSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "ভুল ইমেইল অথবা পাসওয়ার্ড" };
  }

  const role = await getUserRole(supabase);
  redirect(role ? roleLandingPath(role) : "/");
}

export async function requestOtpAction(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = otpRequestSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone });
  if (error) {
    // No SMS provider is configured for this environment (see docs/DEMO.md) — the UI
    // path is real, the delivery isn't, so surface that instead of a generic failure.
    return { error: "ওটিপি পাঠানো যায়নি — SMS প্রোভাইডার এই পরিবেশে কনফিগার করা নেই।" };
  }

  redirect(`/verify?phone=${encodeURIComponent(parsed.data.phone)}`);
}
