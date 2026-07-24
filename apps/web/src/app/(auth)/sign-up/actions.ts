"use server";

import { roleLandingPath } from "@/lib/auth";
import { createClient } from "@/server/supabase/server";
import { redirect } from "next/navigation";
import { insertProfile } from "./data";
import { signUpSchema } from "./schema";

export type SignUpState = { error?: string } | undefined;

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return { error: error?.message === "User already registered" ? "এই ইমেইল দিয়ে অ্যাকাউন্ট আছে" : "সাইন আপ ব্যর্থ হয়েছে" };
  }

  try {
    await insertProfile(supabase, data.user.id, parsed.data.fullName, parsed.data.email);
  } catch {
    return { error: "প্রোফাইল তৈরি করা যায়নি" };
  }

  redirect(roleLandingPath("parent"));
}
