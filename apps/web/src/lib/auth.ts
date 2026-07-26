import { createClient } from "@/server/supabase/server";
import { APP_TO_USER_ROLE, appRoleAtLeast, type AppRole, type UserRole } from "@/lib/roles";
import { redirect } from "next/navigation";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Re-exported so server modules keep one import for the whole role vocabulary. Client
// Components must import from @/lib/roles directly — importing anything from this module
// pulls next/headers into the browser bundle.
export { APP_ROLE_LABEL_BN, appRoleAtLeast, userRoleFor } from "@/lib/roles";
export type { AppRole, UserRole } from "@/lib/roles";

// The claims the Custom Access Token Hook stamps (handbook §8.5, extended by
// 20260726110000_geography_and_scope.sql):
//
//   user_role    the legacy coarse role — what every existing RLS policy and route guard reads
//   app_role     the six-role model — the `role` half of role × scope, for finer capability gates
//   user_status  account lifecycle; anything but `active` denies system-wide
//   aal          Supabase Auth assurance level — `aal2` once a second factor is verified
//
// Scope paths are deliberately NOT claims. An assignment can be edited at any moment and a
// token lives until it expires, so a scope in a token is a stale authorization decision
// waiting to happen. auth_scopes() reads the table on every query instead.
export type Claims = {
  role: UserRole | null;
  appRole: AppRole | null;
  status: string;
  aal: string;
};

// Decoding the token rather than re-verifying it with getUser() is deliberate: this is
// post-login UX routing, and the real authorization decision is RLS. A spoofed claim still
// meets a policy that reads the same claim server-side.
export async function getClaims(supabase: SupabaseServerClient): Promise<Claims | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as Record<
      string,
      unknown
    >;
    // A missing status claim means the token predates the status hook. Treating it as
    // suspended would sign out every live session mid-deploy, so it reads as active — exactly
    // as auth_role() does in SQL.
    const status = (raw.user_status as string | undefined) ?? "active";
    const claimedAppRole = (raw.app_role as AppRole | undefined) ?? null;
    const claimedRole = (raw.user_role as UserRole | undefined) ?? null;

    // Tokens minted before the assignments migration carry no app_role. Deriving one from the
    // legacy claim keeps a live session working until its next refresh.
    const appRole: AppRole | null =
      claimedAppRole ??
      (claimedRole === "admin"
        ? "programme_manager"
        : claimedRole === "worker"
          ? "field_worker"
          : claimedRole === "parent"
            ? "guardian"
            : null);

    return {
      status,
      aal: (raw.aal as string | undefined) ?? "aal1",
      appRole,
      role: claimedRole ?? (appRole ? APP_TO_USER_ROLE[appRole] : null),
    };
  } catch {
    return null;
  }
}

// A suspended account is already denied by RLS — auth_role() returns NULL for anything but
// 'active', so every role-based policy fails. Mirroring that here is what stops the account
// from *reaching* an admin screen and finding every table mysteriously empty.
export async function getUserRole(supabase: SupabaseServerClient): Promise<UserRole | null> {
  const claims = await getClaims(supabase);
  if (!claims || claims.status !== "active") return null;
  return claims.role;
}

export async function getAppRole(supabase: SupabaseServerClient): Promise<AppRole | null> {
  const claims = await getClaims(supabase);
  if (!claims || claims.status !== "active") return null;
  return claims.appRole;
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

// The finer gate, for screens that exist for one capability rather than one shell — role
// assignment, the denominator, break-glass review. Anything below the minimum goes back to
// its own landing page rather than to sign-in: they are signed in, just not for this.
export async function requireAppRole(minimum: AppRole) {
  const supabase = await createClient();
  const claims = await getClaims(supabase);
  if (!claims || claims.status !== "active" || !claims.role) redirect("/sign-in");
  if (!appRoleAtLeast(claims.appRole, minimum)) redirect(roleLandingPath(claims.role));
  return { supabase, claims };
}

// MFA gate, application half. The database half — mfa_satisfied(), applied to role grants,
// system settings, the population denominator and the full audit trail — is what actually
// enforces it. This half is what makes the failure explainable: a redirect to enrolment,
// rather than a permission error on a screen the user cannot fix from.
//
// The requirement is read from app_settings rather than from a constant, so switching it on
// in production is an operational act and not a deploy (handbook §9.2).
export async function mfaGate(supabase: SupabaseServerClient, claims: Claims) {
  if (!appRoleAtLeast(claims.appRole, "programme_manager")) return;
  if (claims.aal === "aal2") return;

  const { data: required } = await supabase.rpc("setting_bool", {
    p_key: "require_mfa_elevated",
  });
  if (!required) return;

  redirect("/account/security?required=1");
}

// TODO 1.13: the redirect target is always derived from the JWT claims, never from the role
// picked on A2 — that selection only pre-fills the login form.
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
