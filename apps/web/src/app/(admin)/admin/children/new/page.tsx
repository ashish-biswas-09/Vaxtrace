import Link from "next/link";
import { requireRole, requireUser } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { LEVEL_LABEL_BN, nlevel, type LocationNode } from "@/lib/locations";
import { RegisterChildForm } from "../../../../(worker)/worker/_components/RegisterChildForm";
export const metadata = { title: "নতুন শিশু নিবন্ধন" };

export const dynamic = "force-dynamic";

// Same form, same server action, same RLS policy — an admin registering a child is not a
// different operation from a worker doing it, so it is not a different implementation. Only
// the shell and the post-registration redirect differ.
export default async function AdminRegisterChildPage() {
  await requireRole("admin");
  const { supabase, user } = await requireUser();

  const [{ data: guardians }, { data: locations }, { data: profile }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id, full_name, phone")
      .is("deleted_at", null)
      .order("full_name")
      .limit(500),
    supabase
      .from("locations")
      .select("id, name_bn, name_en, level, path, parent_id")
      .is("valid_to", null)
      .order("path"),
    supabase.from("profiles").select("default_location_id").eq("id", user.id).maybeSingle(),
  ]);

  const nodes = (locations ?? []) as LocationNode[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/children" className="text-sm text-[var(--color-primary)]">
          ← শিশু তালিকা
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">নতুন শিশু নিবন্ধন</h1>
      </div>
      <RegisterChildForm
        guardians={guardians ?? []}
        areas={nodes.map((n) => ({
          id: n.id,
          depth: nlevel(n.path) - 1,
          label: `${n.name_bn} · ${LEVEL_LABEL_BN[n.level]}`,
        }))}
        today={todayIso()}
        defaultAreaId={profile?.default_location_id ?? null}
      />
    </div>
  );
}
