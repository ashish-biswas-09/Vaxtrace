"use server";

import { requireUser } from "@/lib/auth";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionState = { error?: string; ok?: string } | undefined;

const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // matches the bucket's own file_size_limit

// ---------------------------------------------------------------------------
// Personal information
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  full_name: z.string().trim().min(1, "নাম লিখুন").max(120),
  // Phone (E.164-ish) or email — `contact` is the single primary-contact field.
  contact: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^\+?[0-9\s-]{6,20}$/.test(v) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: "ফোন নম্বর বা ইমেইল সঠিক নয়",
    }),
  address: z.string().trim().max(300),
  locale: z.enum(["bn", "en"]),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    contact: formData.get("contact") ?? "",
    address: formData.get("address") ?? "",
    locale: formData.get("locale") ?? "bn",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      // '' clears the column; the CHECK constraints reject empty strings but allow NULL.
      contact: parsed.data.contact || null,
      address: parsed.data.address || null,
      locale: parsed.data.locale,
    })
    .eq("id", user.id);

  if (error) return { error: "সংরক্ষণ ব্যর্থ হয়েছে।" };
  revalidatePath("/account");
  return { ok: "তথ্য হালনাগাদ হয়েছে।" };
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------
const passwordSchema = z
  .object({
    current_password: z.string().min(1, "বর্তমান পাসওয়ার্ড দিন"),
    new_password: z.string().min(8, "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে").max(72),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "দুটি পাসওয়ার্ড মেলেনি",
  })
  .refine((d) => d.new_password !== d.current_password, {
    message: "নতুন পাসওয়ার্ড আগেরটির মতো হতে পারবে না",
  });

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordSchema.safeParse({
    current_password: formData.get("current_password") ?? "",
    new_password: formData.get("new_password") ?? "",
    confirm_password: formData.get("confirm_password") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  const { supabase, user } = await requireUser();
  if (!user.email) return { error: "এই অ্যাকাউন্টে ইমেইল নেই — পাসওয়ার্ড পরিবর্তন সম্ভব নয়।" };

  // Re-authenticate before changing the credential. updateUser() alone would let anyone
  // with a borrowed session silently take the account over; proving knowledge of the
  // current password is what makes the change safe on a shared clinic workstation.
  //
  // persistSession:false matters: the cookie-backed server client would write the freshly
  // minted tokens into the user's live session as a side effect of the check. This one
  // holds no storage, so verifying is a pure yes/no with nothing to clean up.
  const verifier = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: reauthError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (reauthError) return { error: "বর্তমান পাসওয়ার্ড সঠিক নয়।" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) return { error: "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।" };

  return { ok: "পাসওয়ার্ড পরিবর্তন হয়েছে।" };
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
const emailSchema = z.object({ email: z.string().trim().email("ইমেইল সঠিক নয়") });

export async function changeEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ইমেইল সঠিক নয়" };

  const { supabase, user } = await requireUser();
  if (parsed.data.email === user.email) return { error: "এটি ইতিমধ্যে আপনার ইমেইল।" };

  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
  if (error) return { error: "ইমেইল পরিবর্তন ব্যর্থ হয়েছে।" };

  // Supabase does not switch the address until the new one is confirmed, so say so
  // rather than showing a success that has not happened yet.
  return { ok: "নিশ্চিতকরণ লিংক নতুন ইমেইলে পাঠানো হয়েছে।" };
}

// ---------------------------------------------------------------------------
// Profile picture
// ---------------------------------------------------------------------------
export async function uploadAvatarAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "কোনো ছবি নির্বাচন করা হয়নি।" };
  if (!ACCEPTED_IMAGE.includes(file.type)) return { error: "JPEG, PNG বা WebP ছবি দিন।" };
  if (file.size > MAX_AVATAR_BYTES) return { error: "ছবির আকার সর্বোচ্চ ২ মেগাবাইট।" };

  const { supabase, user } = await requireUser();

  // Path must start with the user's id — the storage policy keys on that first folder
  // segment, so a user physically cannot write into someone else's folder. The extension
  // comes from the validated MIME type, never from the uploaded filename.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { error: "ছবি আপলোড ব্যর্থ হয়েছে।" };

  const { data: prev } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) return { error: "ছবি সংরক্ষণ ব্যর্থ হয়েছে।" };

  // Replacing a jpg with a png leaves the old object behind; remove it so a "replace"
  // does not quietly accumulate files the user believes they deleted.
  if (prev?.avatar_path && prev.avatar_path !== path) {
    await supabase.storage.from("avatars").remove([prev.avatar_path]);
  }

  revalidatePath("/account");
  return { ok: "প্রোফাইল ছবি হালনাগাদ হয়েছে।" };
}

export async function deleteAvatarAction(): Promise<void> {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();

  if (profile?.avatar_path) {
    await supabase.storage.from("avatars").remove([profile.avatar_path]);
  }
  await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  revalidatePath("/account");
}
