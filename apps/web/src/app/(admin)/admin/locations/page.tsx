import { getAppRole, mfaGate, requireAppRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { LEVEL_LABEL_BN, nlevel, type LocationNode } from "@/lib/locations";
import { StatusBadge } from "@/components/ui/kit";
import { CreateLocationForm } from "./_components/LocationForms";
export const metadata = { title: "প্রশাসনিক এলাকা" };

export const dynamic = "force-dynamic";

// The administrative hierarchy (report §11). Every scoped policy in the system resolves
// through this tree: a child carries the ltree path of its ward, a posting carries the path
// of its area, and access is one containment test between them.
export default async function LocationsPage() {
  const { supabase, claims } = await requireAppRole("programme_manager");
  await mfaGate(supabase, claims);
  const appRole = await getAppRole(supabase);

  const [{ data: locations }, { data: childCounts }, { data: facilities }] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name_bn, name_en, level, path, parent_id, is_urban, geo_code, valid_to")
      .order("path"),
    supabase.from("children").select("location_path").is("deleted_at", null),
    supabase.from("facilities").select("id, location_id").eq("is_active", true),
  ]);

  const nodes = (locations ?? []) as (LocationNode & {
    is_urban: boolean;
    geo_code: string | null;
    valid_to: string | null;
  })[];

  // Registered children roll up the tree: a district's count is every child at or below it.
  // Counting by path prefix in one pass beats a recursive query for a tree this size, and it
  // is exactly the containment the database does with `<@`.
  const rollup = new Map<string, number>();
  for (const c of childCounts ?? []) {
    const parts = c.location_path.split(".");
    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.slice(0, i + 1).join(".");
      rollup.set(prefix, (rollup.get(prefix) ?? 0) + 1);
    }
  }

  const facilityCount = new Map<string, number>();
  for (const f of facilities ?? []) {
    facilityCount.set(f.location_id, (facilityCount.get(f.location_id) ?? 0) + 1);
  }

  // The country root is the anchor of every ltree path and the scope a national posting
  // attaches to, so it stays in the database — but it is not an administrative area anyone
  // administers, and listing it as a row just repeats the grand total under the name
  // "বাংলাদেশ". The table starts at the divisions, which is where the hierarchy becomes
  // operational. The same rule is why the area picker's first select offers divisions.
  const areas = nodes.filter((n) => n.parent_id !== null);
  const open = areas.filter((n) => n.valid_to === null);
  const withoutGeoCode = open.filter((n) => !n.geo_code).length;
  // The root is still offered as a PARENT — a new division has to hang off something — it is
  // only excluded from the list of areas.
  const parentOptions = nodes.filter((n) => n.valid_to === null);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">প্রশাসনিক এলাকা</h1>
        <p className="text-sm text-[var(--color-muted)]">
          মোট {toBn(open.length)} টি সক্রিয় এলাকা। প্রতিটি শিশু, কেন্দ্র ও দায়িত্ব এই কাঠামোর
          একটি নোডের সঙ্গে যুক্ত — এখান থেকেই প্রবেশাধিকার ও এলাকাভিত্তিক রিপোর্ট নির্ধারিত হয়।
        </p>
      </header>

      {withoutGeoCode > 0 && (
        // Named rather than hidden: the geocode is the join key to census data, and the
        // denominator cannot be loaded against a tree that has none.
        <p
          role="status"
          className="rounded-md border border-[var(--color-warning)] px-4 py-3 text-sm text-[var(--color-warning)]"
        >
          {toBn(withoutGeoCode)} টি এলাকার সরকারি জিও-কোড (BBS) নেই। আদমশুমারির জনসংখ্যা তথ্য
          যুক্ত করতে হলে এই কোডগুলো লোড করতে হবে।
        </p>
      )}

      <section className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                এলাকা
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                স্তর
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                জিও-কোড
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                শিশু
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                কেন্দ্র
              </th>
            </tr>
          </thead>
          <tbody>
            {areas.map((n) => {
              // Depth is measured from the divisions, so the first column is not indented by
              // a root that is no longer shown.
              const depth = nlevel(n.path) - 2;
              return (
                <tr
                  key={n.id}
                  className={`border-t border-[var(--color-border)] ${
                    n.valid_to ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span style={{ paddingInlineStart: `${depth * 1.25}rem` }} className="block">
                      {n.name_bn}
                      <span className="ml-2 text-xs text-[var(--color-muted)]">{n.name_en}</span>
                      {n.is_urban && (
                        <span className="ml-2 align-middle">
                          <StatusBadge tone="muted">শহর</StatusBadge>
                        </span>
                      )}
                      {n.valid_to && (
                        <span className="ml-2 align-middle">
                          <StatusBadge tone="danger">বন্ধ</StatusBadge>
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">
                    {LEVEL_LABEL_BN[n.level]}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-muted)]">
                    {n.geo_code ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {/* Zero is a real answer here and an em-dash is not: an area with no
                        registered children is the finding, not a missing value. */}
                    {toBn(rollup.get(n.path) ?? 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {toBn(facilityCount.get(n.id) ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {appRole === "system_admin" ? (
        <section className="rounded-xl border border-[var(--color-border)] p-5">
          <h2 className="mb-1 text-lg font-medium">নতুন এলাকা যোগ করুন</h2>
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            একটি এলাকা কখনো মুছে ফেলা বা সরানো হয় না — সীমানা বদলালে পুরনোটি বন্ধ করে নতুন একটি
            খোলা হয়, যাতে পুরনো রিপোর্ট অপরিবর্তিত থাকে।
          </p>
          <CreateLocationForm
            options={parentOptions
              .filter((n) => n.level !== "village" && n.level !== "mahalla")
              .map((n) => ({
                id: n.id,
                level: n.level,
                depth: nlevel(n.path) - 1,
                label: `${n.name_bn} · ${LEVEL_LABEL_BN[n.level]}`,
              }))}
          />
        </section>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">
          এলাকা যোগ বা পরিবর্তন করতে সিস্টেম অ্যাডমিন অনুমতি প্রয়োজন — একটি এলাকা বদলালে তার
          অধীনের সব দায়িত্বের পরিধিও বদলে যায়।
        </p>
      )}
    </div>
  );
}
