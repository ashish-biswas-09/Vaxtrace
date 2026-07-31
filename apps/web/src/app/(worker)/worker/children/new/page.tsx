import Link from "next/link";
import { requireRole, requireUser } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { type LocationNode } from "@/lib/locations";
import { RegisterChildForm } from "../../_components/RegisterChildForm";

export const dynamic = "force-dynamic";

export default async function RegisterChildPage() {
  await requireRole("worker");
  const { supabase, user } = await requireUser();

  // Guardians are domain records now, not accounts (BS-02). The list is whatever this worker
  // can see — guardians_select already scopes it to their catchment — and an empty list is no
  // longer a dead end, because the form can create one inline.
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
        <Link href="/worker" className="text-sm text-[var(--color-primary)]">
          ← কনসোল
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">শিশু নিবন্ধন</h1>
        <p className="text-sm text-[var(--color-muted)]">
          নতুন শিশুকে টিকাদান কর্মসূচিতে যুক্ত করুন
        </p>
      </div>

      <RegisterChildForm
        guardians={guardians ?? []}
        areas={nodes}
        today={todayIso()}
        defaultAreaId={profile?.default_location_id ?? null}
      />
    </div>
  );
}
