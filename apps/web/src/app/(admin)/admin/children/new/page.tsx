import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import {
  RegisterChildForm,
  type GuardianOption,
} from "../../../../(worker)/worker/_components/RegisterChildForm";

export const dynamic = "force-dynamic";

// Same form, same server action, same RLS policy — an admin registering a child is not a
// different operation from a worker doing it, so it is not a different implementation. Only
// the shell and the post-registration redirect differ.
export default async function AdminRegisterChildPage() {
  const supabase = await requireRole("admin");

  const { data: parentRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "parent");

  const ids = (parentRoles ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, contact")
        .in("id", ids)
        .eq("status", "active")
        .order("full_name")
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/children" className="text-sm text-[var(--color-primary)]">
          ← শিশু তালিকা
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">নতুন শিশু নিবন্ধন</h1>
      </div>
      <RegisterChildForm guardians={(profiles ?? []) as GuardianOption[]} today={todayIso()} />
    </div>
  );
}
