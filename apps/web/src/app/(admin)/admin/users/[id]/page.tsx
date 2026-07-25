import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_ROLE_LABEL_BN, mfaGate, requireAppRole, type AppRole } from "@/lib/auth";
import { dateBn, toBn } from "@/lib/format";
import { pathTrail, toIndentedOptions, type LocationNode } from "@/lib/locations";
import { StatusBadge } from "../../_components/ui";
import { GrantAssignmentForm, RevokeAssignmentButton } from "./_components/AssignmentForms";

export const dynamic = "force-dynamic";

// A user's postings. This is where `permission = role × scope` stops being a diagram: a
// District Health Officer is `programme_manager @ district:Gazipur`, an Upazila Health Officer
// is the same role at `upazila:Kaliakair`, and no policy in the system knows the difference.
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, claims } = await requireAppRole("programme_manager");
  await mfaGate(supabase, claims);

  const [
    { data: profile },
    { data: legacyRoles },
    { data: assignments },
    { data: locations },
    { data: facilities },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, contact, phone, email, status, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("user_roles").select("role, staff_code").eq("user_id", id),
    supabase
      .from("user_assignments")
      .select("id, role, location_id, facility_id, valid_from, valid_to, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("locations")
      .select("id, name_bn, name_en, level, path, parent_id")
      .is("valid_to", null),
    supabase.from("facilities").select("id, name_bn, code, location_id").eq("is_active", true),
  ]);

  if (!profile) notFound();

  const nodes = (locations ?? []) as LocationNode[];
  const byId = new Map(nodes.map((l) => [l.id, l]));
  const byPath = new Map(nodes.map((l) => [l.path, l]));
  const facilityById = new Map((facilities ?? []).map((f) => [f.id, f]));

  const today = new Date().toISOString().slice(0, 10);
  const isLive = (a: { valid_from: string; valid_to: string | null }) =>
    a.valid_from <= today && (a.valid_to === null || a.valid_to >= today);

  const live = (assignments ?? []).filter(isLive);
  const closed = (assignments ?? []).filter((a) => !isLive(a));

  const scopeLabel = (a: { location_id: string | null; facility_id: string | null }) => {
    if (a.location_id) {
      const node = byId.get(a.location_id);
      return node ? pathTrail(node.path, byPath) : "—";
    }
    if (a.facility_id) {
      const f = facilityById.get(a.facility_id);
      return f ? `${f.name_bn} (${f.code})` : "—";
    }
    return "—";
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm text-[var(--color-primary)]">
          ← ব্যবহারকারী তালিকায় ফিরুন
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{profile.full_name}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          {profile.phone ?? profile.email ?? profile.contact ?? "যোগাযোগের তথ্য নেই"} ·{" "}
          {(legacyRoles ?? []).map((r) => r.staff_code).join(", ") || "কোনো কর্মী আইডি নেই"} ·
          নিবন্ধিত {dateBn(profile.created_at)}
        </p>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-1 text-lg font-medium">বর্তমান দায়িত্ব ({toBn(live.length)})</h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          একজন ব্যবহারকারী একাধিক দায়িত্ব রাখতে পারেন। প্রবেশাধিকার সবসময় সবচেয়ে উঁচু সক্রিয়
          ভূমিকা থেকে নির্ধারিত হয়, এবং তথ্য দেখা যায় শুধু বরাদ্দকৃত এলাকার ভেতরে।
        </p>

        {live.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            কোনো সক্রিয় দায়িত্ব নেই — এই ব্যবহারকারী কোনো শিশুর তথ্য দেখতে পারবেন না।
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    ভূমিকা
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    পরিধি
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    শুরু
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    মেয়াদ শেষ
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">কাজ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {live.map((a) => (
                  <tr key={a.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3">
                      <StatusBadge tone="primary">
                        {APP_ROLE_LABEL_BN[a.role as AppRole]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">{scopeLabel(a)}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{dateBn(a.valid_from)}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {a.valid_to ? dateBn(a.valid_to) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RevokeAssignmentButton assignmentId={a.id} userId={profile.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-4 text-lg font-medium">নতুন দায়িত্ব বরাদ্দ</h2>
        <GrantAssignmentForm
          userId={profile.id}
          locations={toIndentedOptions(nodes)}
          facilities={(facilities ?? []).map((f) => ({
            id: f.id,
            label: `${f.name_bn} (${f.code})`,
          }))}
        />
      </section>

      {closed.length > 0 && (
        <section className="rounded-xl border border-[var(--color-border)] p-5">
          <h2 className="mb-1 text-lg font-medium">পূর্বের দায়িত্ব ({toBn(closed.length)})</h2>
          {/* Closed rather than deleted, so "who could see this child last March" stays a
              question the audit trail can answer. */}
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            প্রত্যাহার করা দায়িত্ব মুছে ফেলা হয় না — অডিটের জন্য রেকর্ড থাকে।
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {closed.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-2 text-[var(--color-muted)]">
                <span>{APP_ROLE_LABEL_BN[a.role as AppRole]}</span>
                <span>·</span>
                <span>{scopeLabel(a)}</span>
                <span>·</span>
                <span>
                  {dateBn(a.valid_from)} — {a.valid_to ? dateBn(a.valid_to) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
