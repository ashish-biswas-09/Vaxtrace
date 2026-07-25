"use server";

import { requireRole } from "@/lib/auth";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type RoleActionState = { error?: string; ok?: boolean } | undefined;
export type UserActionState = { error?: string; ok?: string } | undefined;

const schema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["parent", "worker", "admin"]),
});

// Assigns a user exactly one role (D7). Upsert-then-prune so the account is never left
// role-less mid-change (which would strip its JWT claim to the 'parent' fallback). Both the
// insert and the delete are audited by the user_roles trigger.
export async function setRoleAction(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const parsed = schema.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "তথ্য সঠিক নয়" };

  const supabase = await requireRole("admin");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === parsed.data.user_id) {
    return { error: "নিজের ভূমিকা পরিবর্তন করা যাবে না।" };
  }

  const { error: upErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: parsed.data.user_id, role: parsed.data.role });
  if (upErr) return { error: "ভূমিকা পরিবর্তন ব্যর্থ হয়েছে।" };

  const { error: delErr } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", parsed.data.user_id)
    .neq("role", parsed.data.role);
  if (delErr) return { error: "পুরনো ভূমিকা মুছতে ব্যর্থ হয়েছে।" };

  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Account status lifecycle
// ---------------------------------------------------------------------------
const statusSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["invited", "active", "inactive"]),
});

// Deactivating an account is the only way to revoke access short of deleting the user, so it
// is the one control here with real teeth: `auth_role()` returns NULL for a non-active
// account, which makes every role-based RLS policy deny system-wide. A BEFORE UPDATE trigger
// on profiles rejects the change unless the caller is an admin, so this action is the second
// line of defence rather than the only one.
export async function setUserStatusAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const parsed = statusSchema.safeParse({
    user_id: formData.get("user_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "তথ্য সঠিক নয়" };

  const supabase = await requireRole("admin");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Locking yourself out is not a recoverable mistake from inside the app.
  if (user?.id === parsed.data.user_id) {
    return { error: "নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না।" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.user_id);
  if (error) return { error: "অবস্থা পরিবর্তন ব্যর্থ হয়েছে।" };

  revalidatePath("/admin/users");
  return { ok: "অবস্থা পরিবর্তন হয়েছে।" };
}

// ---------------------------------------------------------------------------
// Staff invitation
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.string().trim().email("সঠিক ইমেইল দিন"),
  full_name: z.string().trim().min(1, "নাম লিখুন").max(120),
  role: z.enum(["parent", "worker", "admin"]),
});

// Workers and admins are provisioned, never self-registered (§7.0a) — public sign-up only
// ever grants 'parent'. This is therefore the only path by which staff exist at all.
//
// It needs the service role: creating another user is an Admin API operation, and the anon
// key deliberately cannot do it. The key is read at call time and its absence is reported
// plainly rather than being papered over with a fake success.
export async function inviteUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  }

  // requireRole first: never touch the service role before the caller is proven to be admin.
  await requireRole("admin");

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY সেট করা নেই — আমন্ত্রণ পাঠানোর জন্য এটি প্রয়োজন (.env.local দেখুন)।",
    };
  }

  const admin = createStatelessClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email);
  if (error || !data.user) {
    return {
      error:
        error?.status === 422
          ? "এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।"
          : "আমন্ত্রণ পাঠানো যায়নি।",
    };
  }

  // Profile starts as `invited`; the hook stamps that onto the JWT, so the account cannot do
  // anything role-gated until an admin activates it after the first sign-in.
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    full_name: parsed.data.full_name,
    contact: parsed.data.email,
    status: "invited",
  });
  if (profileError) return { error: "প্রোফাইল তৈরি করা যায়নি।" };

  // staff_code is minted by the user_roles guard trigger — never supplied here.
  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: data.user.id, role: parsed.data.role });
  if (roleError) return { error: "ভূমিকা বরাদ্দ করা যায়নি।" };

  revalidatePath("/admin/users");
  return { ok: `${parsed.data.email}-এ আমন্ত্রণ পাঠানো হয়েছে।` };
}
