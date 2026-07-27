import { mfaGate, requireAppRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import {
  FACILITY_TYPE_LABEL_BN,
  LEVEL_LABEL_BN,
  nlevel,
  pathTrail,
  type LocationNode,
} from "@/lib/locations";
import { StatusBadge } from "@/components/ui/kit";
import {
  CatchmentEditor,
  CreateFacilityForm,
  RemoveCatchmentButton,
} from "./_components/FacilityForms";
export const metadata = { title: "সেবা কেন্দ্র" };

export const dynamic = "force-dynamic";

// Service delivery points (report §11.4, BS-03). Before this screen a dose knew who
// administered it and when, but not where — so facility-level coverage was impossible, stock
// could not be issued to a place, and supervision could not be targeted.
export default async function FacilitiesPage() {
  const { supabase, claims } = await requireAppRole("programme_manager");
  await mfaGate(supabase, claims);

  const [{ data: facilities }, { data: locations }, { data: catchments }, { data: children }] =
    await Promise.all([
      supabase
        .from("facilities")
        .select("id, code, name_bn, name_en, type, location_id, is_store, is_active")
        .order("code"),
      supabase
        .from("locations")
        .select("id, name_bn, name_en, level, path, parent_id")
        .is("valid_to", null)
        .order("path"),
      supabase.from("facility_catchments").select("facility_id, location_id, is_primary"),
      supabase.from("children").select("facility_id").is("deleted_at", null),
    ]);

  const nodes = (locations ?? []) as LocationNode[];
  const byId = new Map(nodes.map((l) => [l.id, l]));
  const byPath = new Map(nodes.map((l) => [l.path, l]));

  const catchmentsByFacility = new Map<string, { location_id: string; is_primary: boolean }[]>();
  for (const c of catchments ?? []) {
    const list = catchmentsByFacility.get(c.facility_id) ?? [];
    list.push({ location_id: c.location_id, is_primary: c.is_primary });
    catchmentsByFacility.set(c.facility_id, list);
  }

  const childrenByFacility = new Map<string, number>();
  for (const c of children ?? []) {
    if (!c.facility_id) continue;
    childrenByFacility.set(c.facility_id, (childrenByFacility.get(c.facility_id) ?? 0) + 1);
  }

  const options = nodes.map((n) => ({
    id: n.id,
    depth: nlevel(n.path) - 1,
    label: `${n.name_bn} · ${LEVEL_LABEL_BN[n.level]}`,
  }));

  const rows = facilities ?? [];
  const stores = rows.filter((f) => f.is_store).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">সেবা কেন্দ্র</h1>
        <p className="text-sm text-[var(--color-muted)]">
          মোট {toBn(rows.length)} টি কেন্দ্র, এর মধ্যে {toBn(stores)} টিতে টিকার মজুদ থাকে। একটি
          কেন্দ্র প্রশাসনিক কাঠামোর স্তর নয় — এটি একটি এলাকায় <em>অবস্থিত</em> এবং একাধিক এলাকায়{" "}
          <em>সেবা দেয়</em>।
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
          এখনো কোনো কেন্দ্র নেই। কেন্দ্র ছাড়া ডোজ কোথায় দেওয়া হয়েছে তা রেকর্ড করা যায় না।
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((f) => {
            const location = byId.get(f.location_id);
            const served = catchmentsByFacility.get(f.id) ?? [];
            return (
              <section
                key={f.id}
                className="rounded-xl border border-[var(--color-border)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">
                      {f.name_bn}{" "}
                      <span className="font-mono text-xs text-[var(--color-muted)]">
                        {f.code}
                      </span>
                    </h2>
                    <p className="text-sm text-[var(--color-muted)]">
                      {FACILITY_TYPE_LABEL_BN[f.type]} ·{" "}
                      {location ? pathTrail(location.path, byPath) : "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {f.is_store && <StatusBadge tone="primary">স্টোর</StatusBadge>}
                    {!f.is_active && <StatusBadge tone="danger">নিষ্ক্রিয়</StatusBadge>}
                    <StatusBadge tone="muted">
                      {toBn(childrenByFacility.get(f.id) ?? 0)} শিশু
                    </StatusBadge>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">
                    সেবা এলাকা ({toBn(served.length)})
                  </p>
                  <ul className="mb-3 flex flex-wrap gap-2">
                    {served.map((c) => {
                      const node = byId.get(c.location_id);
                      return (
                        <li
                          key={c.location_id}
                          className="flex items-center rounded-full border border-[var(--color-border)] px-3 py-1 text-xs"
                        >
                          {node ? node.name_bn : "—"}
                          {c.is_primary && (
                            <span className="ml-1 text-[var(--color-primary)]">•</span>
                          )}
                          <RemoveCatchmentButton facilityId={f.id} locationId={c.location_id} />
                        </li>
                      );
                    })}
                    {served.length === 0 && (
                      <li className="text-xs text-[var(--color-danger)]">
                        কোনো সেবা এলাকা নেই — এই কেন্দ্রের কভারেজ হিসাব করা যাবে না।
                      </li>
                    )}
                  </ul>
                  <CatchmentEditor facilityId={f.id} locations={options} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-4 text-lg font-medium">নতুন কেন্দ্র যোগ করুন</h2>
        <CreateFacilityForm locations={options} />
      </section>
    </div>
  );
}
