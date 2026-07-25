import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { RegisterChildForm, type GuardianOption } from "../../_components/RegisterChildForm";

export const dynamic = "force-dynamic";

export default async function RegisterChildPage() {
  const supabase = await requireRole("worker");

  // Guardians are existing parent accounts. A child cannot be attached to a person who has
  // no account, because guardian_id is a real foreign key to profiles — that is what makes
  // "send this guardian a reminder" possible at all. New guardians arrive by self sign-up or
  // by an admin invitation.
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
        <Link href="/worker" className="text-sm text-[var(--color-primary)]">
          ← কনসোল
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">শিশু নিবন্ধন</h1>
        <p className="text-sm text-[var(--color-muted)]">
          নতুন শিশুকে টিকাদান কর্মসূচিতে যুক্ত করুন
        </p>
      </div>

      <RegisterChildForm guardians={(profiles ?? []) as GuardianOption[]} today={todayIso()} />
    </div>
  );
}
