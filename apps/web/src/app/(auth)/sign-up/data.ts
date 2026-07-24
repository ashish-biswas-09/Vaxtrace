import type { createClient } from "@/server/supabase/server";

// Self-service sign-up only ever grants the 'parent' role — RLS enforces this too
// (roles_self_insert_parent, migration 20260724120000), this is the same rule applied
// at the call site so a bad insert fails fast with a clear cause.
export async function insertProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fullName: string,
  contact: string,
) {
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, full_name: fullName, contact });
  if (profileError) throw profileError;

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "parent" });
  if (roleError) throw roleError;
}
