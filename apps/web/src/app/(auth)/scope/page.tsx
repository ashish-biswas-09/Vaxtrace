import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_ROLE_LABEL_BN, getUserRole, requireUser, roleLandingPath } from "@/lib/auth";
import type { AppRole } from "@/lib/roles";
import { dateBn } from "@/lib/format";
import { pathTrail, type LocationNode } from "@/lib/locations";
import { WorkingAreaForm } from "./_components/WorkingAreaForm";

export const dynamic = "force-dynamic";

// Working-area selection for a user who holds more than one posting (report §13.1).
//
// The honest framing matters here. A user's permissions are the *union* of every live
// assignment — auth_scopes() returns them all and RLS honours all of them, always. This
// screen picks which of those areas the console opens on and which a newly registered child
// inherits. It does not drop privileges, and it says so, because a control that looks like a
// security boundary but is not is worse than no control.
export default async function ScopePage() {
  const { supabase, user } = await requireUser();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: assignments }, { data: profile }, { data: locations }, { data: facilities }] =
    await Promise.all([
      supabase
        .from("user_assignments")
        .select("id, role, location_id, facility_id, valid_from, valid_to")
        .eq("user_id", user.id)
        .lte("valid_from", today)
        .or(`valid_to.is.null,valid_to.gte.${today}`),
      supabase.from("profiles").select("default_location_id").eq("id", user.id).maybeSingle(),
      supabase
        .from("locations")
        .select("id, name_bn, name_en, level, path, parent_id")
        .is("valid_to", null),
      supabase.from("facilities").select("id, name_bn, code, location_id"),
    ]);

  const live = assignments ?? [];
  const role = await getUserRole(supabase);

  // Nothing to choose between: one posting, or none. Sending the user to a picker with a
  // single option is a step that exists only to be dismissed.
  if (live.length < 2) redirect(role ? roleLandingPath(role) : "/");

  const nodes = (locations ?? []) as LocationNode[];
  const byId = new Map(nodes.map((l) => [l.id, l]));
  const byPath = new Map(nodes.map((l) => [l.path, l]));
  const facilityById = new Map((facilities ?? []).map((f) => [f.id, f]));

  const options = live
    .map((a) => {
      const locationId =
        a.location_id ?? (a.facility_id ? (facilityById.get(a.facility_id)?.location_id ?? null) : null);
      const node = locationId ? byId.get(locationId) : undefined;
      return {
        id: locationId ?? "",
        role: a.role as AppRole,
        roleLabel: APP_ROLE_LABEL_BN[a.role as AppRole],
        area: node ? pathTrail(node.path, byPath) : "—",
        facility: a.facility_id ? (facilityById.get(a.facility_id)?.name_bn ?? null) : null,
        until: a.valid_to ? dateBn(a.valid_to) : null,
      };
    })
    .filter((o) => o.id !== "");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">কোন এলাকায় কাজ করবেন?</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--color-muted)]">
          আপনার একাধিক দায়িত্ব রয়েছে। এখানে বেছে নেওয়া এলাকাটি ডিফল্ট হিসেবে ব্যবহৃত হবে —
          কনসোল এই এলাকা দিয়ে শুরু হবে এবং নতুন নিবন্ধিত শিশু এই এলাকায় যুক্ত হবে।
        </p>
        {/* Said plainly rather than left to be discovered: this narrows the view, not the
            permission. */}
        <p className="mx-auto mt-2 max-w-lg text-xs text-[var(--color-muted)]">
          মনে রাখুন: এতে আপনার প্রবেশাধিকার কমে না। আপনি আপনার সব দায়িত্বের এলাকার তথ্যই দেখতে
          পাবেন।
        </p>
      </div>

      <WorkingAreaForm options={options} current={profile?.default_location_id ?? null} />

      <Link
        href={role ? roleLandingPath(role) : "/"}
        className="text-sm text-[var(--color-muted)] underline"
      >
        এড়িয়ে যান
      </Link>
    </main>
  );
}
