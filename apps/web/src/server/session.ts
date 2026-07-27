"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";

// Sign-out lives here rather than in the admin route group because the account menu that
// calls it is shared by the admin shell, the worker console and /account. A shared component
// reaching back into one role's private folder is how the panel ended up with seven files
// outside (admin) importing from (admin)/admin/_components.
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
