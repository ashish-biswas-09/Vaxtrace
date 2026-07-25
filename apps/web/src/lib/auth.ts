import { createClient } from "@/server/supabase/server";
import type { Database } from "@vaxtrace/db-types";
import { redirect } from "next/navigation";

type UserRole = Database["public"]["Enums"]["user_role"];
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Reads the `user_role` custom claim the Custom Access Token Hook stamps onto the JWT
// (handbook §8.5) — the actual authorization decision is RLS on the database, not this;
// this is only used for post-login UX routing, so decoding the token client-side (rather
// than re-verifying with getUser()) is fine — a spoofed redirect still hits RLS.
export async function getUserRole(supabase: SupabaseServerClient): Promise<UserRole | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    // A suspended account is already denied by RLS — auth_role() returns NULL for anything
    // but 'active', so every role-based policy fails. Mirroring that here is what stops the
    // account from *reaching* an admin screen and finding every table mysteriously empty.
    // Missing claim means the token predates the status hook: treat it as active, exactly as
    // the SQL side does, so an existing session is not signed out mid-migration.
    const status = (claims.user_status as string | undefined) ?? "active";
    if (status !== "active") return null;
    return (claims.user_role as UserRole | undefined) ?? null;
  } catch {
    return null;
  }
}

// Guards a page that any signed-in user may see, whatever their role (account management).
// Uses getUser(), not getSession(), because this one *is* a boundary — the account screen
// mutates credentials, so the token gets verified with the auth server rather than decoded.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

// Guards a role's landing page: no session -> sign in; wrong role -> their own landing.
// This is UX routing, not the security boundary (RLS is, §8.5) — but URL-level gating
// still matters so a signed-in worker can't casually browse the admin route tree.
export async function requireRole(expected: UserRole) {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!role) redirect("/sign-in");
  if (role !== expected) redirect(roleLandingPath(role));
  return supabase;
}

// TODO 1.13: the redirect target is always derived from the JWT `user_role` claim,
// never from the role picked on A2 — that selection only pre-fills the login form.
export function roleLandingPath(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "worker":
      return "/worker";
    case "parent":
      return "/parent";
    default:
      role satisfies never;
      throw new Error(`Unknown role: ${role}`);
  }
}
