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
    return (claims.user_role as UserRole | undefined) ?? null;
  } catch {
    return null;
  }
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
