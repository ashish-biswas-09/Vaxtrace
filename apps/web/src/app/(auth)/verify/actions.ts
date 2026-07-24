"use server";

import { getUserRole, roleLandingPath } from "@/lib/auth";
import { createClient } from "@/server/supabase/server";
import { redirect } from "next/navigation";
import { resetPwRequestSchema, verifyOtpSchema } from "./schema";

export type VerifyState = { error?: string; message?: string } | undefined;

export async function verifyOtpAction(
  _prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const parsed = verifyOtpSchema.safeParse({
    phone: formData.get("phone"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });
  if (error) {
    return { error: "ভুল অথবা মেয়াদোত্তীর্ণ ওটিপি" };
  }

  const role = await getUserRole(supabase);
  redirect(role ? roleLandingPath(role) : "/");
}

export async function resetPwAction(
  _prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const parsed = resetPwRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const supabase = await createClient();
  // Never branch on whether the email exists — that leaks account existence.
  await supabase.auth.resetPasswordForEmail(parsed.data.email);
  return { message: "অ্যাকাউন্টটি থাকলে, একটি রিসেট লিংক ইমেইলে পাঠানো হয়েছে।" };
}
