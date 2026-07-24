"use server";

import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type RoleActionState = { error?: string; ok?: boolean } | undefined;

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
