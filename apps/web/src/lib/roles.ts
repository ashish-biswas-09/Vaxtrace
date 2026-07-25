import type { Database } from "@vaxtrace/db-types";

// Role vocabulary, deliberately free of any server import.
//
// lib/auth.ts reaches for next/headers through the Supabase server client, so anything a
// Client Component imports from it drags that module into the browser bundle and the build
// fails. The labels and the rank table are needed on both sides of the boundary — a select
// element renders them, a route guard compares them — so they live here, where either side
// can import them safely.

export type AppRole = Database["public"]["Enums"]["app_role"];
export type UserRole = Database["public"]["Enums"]["user_role"];

// Mirrors public.app_role_rank. Higher wins; gaps of 10 leave room between tiers.
export const APP_ROLE_RANK: Record<AppRole, number> = {
  system_admin: 60,
  programme_manager: 50,
  supervisor: 40,
  store_keeper: 30,
  field_worker: 20,
  guardian: 10,
};

// Mirrors public.app_role_to_user_role. Drift here would route a user into the wrong shell,
// so tests/roles.test.ts asserts both tables against the values the migration defines.
export const APP_TO_USER_ROLE: Record<AppRole, UserRole> = {
  system_admin: "admin",
  programme_manager: "admin",
  supervisor: "worker",
  store_keeper: "worker",
  field_worker: "worker",
  guardian: "parent",
};

export const APP_ROLE_LABEL_BN: Record<AppRole, string> = {
  guardian: "অভিভাবক",
  field_worker: "মাঠকর্মী",
  store_keeper: "স্টোরকিপার",
  supervisor: "সুপারভাইজার",
  programme_manager: "প্রোগ্রাম ম্যানেজার",
  system_admin: "সিস্টেম অ্যাডমিন",
};

// The roles a posting can express. `guardian` is absent on purpose: a guardian's scope is
// ownership of their own children, not geography, and a user_assignments row would imply
// otherwise — which is the confusion the six-role model exists to prevent.
export const GRANTABLE_ROLES: AppRole[] = [
  "field_worker",
  "store_keeper",
  "supervisor",
  "programme_manager",
  "system_admin",
];

export function appRoleAtLeast(role: AppRole | null, minimum: AppRole): boolean {
  if (!role) return false;
  return APP_ROLE_RANK[role] >= APP_ROLE_RANK[minimum];
}

export function userRoleFor(role: AppRole): UserRole {
  return APP_TO_USER_ROLE[role];
}
