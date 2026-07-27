import { mfaGate, requireAppRole } from "@/lib/auth";
import { dateBn, pctBn, toBn } from "@/lib/format";
import { LEVEL_LABEL_BN, nlevel, pathTrail, type LocationNode } from "@/lib/locations";
import { StatCard } from "@/components/ui/kit";
import { AGE_BANDS } from "./_components/age-bands";
import { PopulationForm } from "./_components/PopulationForm";
export const metadata = { title: "জনসংখ্যার হিসাব" };

export const dynamic = "force-dynamic";

// The coverage denominator (report BS-07 / decision D3).
//
// Without this table "coverage" means "of the children we happen to know about, what share
// are up to date" — a data-quality metric that is congratulatory by construction, because a
// catchment that registers only the easy-to-reach children reports near-100% while missing
// exactly the families the programme exists for. With it, the same registry can report a
// public-health number, and zero-dose children become estimable.
export default async function PopulationPage() {
  const { supabase, claims } = await requireAppRole("programme_manager");
  await mfaGate(supabase, claims);

  const year = new Date().getFullYear();

  const [{ data: estimates }, { data: locations }, { data: children }] = await Promise.all([
    supabase
      .from("population_estimates")
      .select("location_id, year, age_band, estimate, source, updated_at")
      .order("year", { ascending: false }),
    supabase
      .from("locations")
      .select("id, name_bn, name_en, level, path, parent_id")
      .is("valid_to", null)
      .order("path"),
    supabase.from("children").select("location_path").is("deleted_at", null),
  ]);

  const nodes = (locations ?? []) as LocationNode[];
  const byId = new Map(nodes.map((l) => [l.id, l]));
  const byPath = new Map(nodes.map((l) => [l.path, l]));

  // Registered children roll up by path prefix, so an estimate at district level can be
  // compared against every child at or below that district.
  const registered = new Map<string, number>();
  for (const c of children ?? []) {
    const parts = c.location_path.split(".");
    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.slice(0, i + 1).join(".");
      registered.set(prefix, (registered.get(prefix) ?? 0) + 1);
    }
  }

  const rows = estimates ?? [];
  const currentYear = rows.filter((r) => r.year === year);
  const totalTarget = currentYear
    .filter((r) => r.age_band === "surviving_infants")
    .reduce((sum, r) => sum + r.estimate, 0);

  const bandLabel = new Map(AGE_BANDS.map((b) => [b.value, b.label]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">জনসংখ্যার হিসাব (হর)</h1>
        <p className="text-sm text-[var(--color-muted)]">
          কভারেজের ভগ্নাংশের নিচের সংখ্যা। এটি ছাড়া কভারেজ মানে দাঁড়ায় &ldquo;আমাদের নিবন্ধিত
          শিশুদের মধ্যে কত শতাংশ সময়মতো টিকা পেয়েছে&rdquo; — যা তথ্যের মান বোঝায়, জনস্বাস্থ্যের
          অবস্থা নয়।
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`${toBn(year)} সালের লক্ষ্য শিশু`}
          value={totalTarget > 0 ? toBn(totalTarget) : "—"}
          hint="জীবিত শিশু (০-১১ মাস), সব এলাকা মিলে"
        />
        <StatCard
          label="নিবন্ধিত শিশু"
          value={toBn(children?.length ?? 0)}
          tone="success"
          hint="সিস্টেমে নথিভুক্ত"
        />
        <StatCard
          label="নিবন্ধন হার"
          value={totalTarget > 0 ? pctBn((children?.length ?? 0) / totalTarget) : "—"}
          tone={totalTarget > 0 ? "warning" : "muted"}
          hint={
            totalTarget > 0
              ? "লক্ষ্যের তুলনায় কতজন নিবন্ধিত — বাকিরা 'শূন্য-ডোজ' হওয়ার ঝুঁকিতে"
              : "হর না থাকলে হিসাব করা যায় না"
          }
        />
      </section>

      {rows.length === 0 && (
        <p
          role="status"
          className="rounded-md border border-[var(--color-warning)] px-4 py-3 text-sm text-[var(--color-warning)]"
        >
          এখনো কোনো জনসংখ্যার হিসাব নেই। এটি যোগ না করা পর্যন্ত সব কভারেজ রিপোর্ট শুধু নিবন্ধিত
          শিশুদের ভিত্তিতে হিসাব হবে, যা প্রকৃত কভারেজ নয়।
        </p>
      )}

      {rows.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  এলাকা
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  বছর
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  বয়স শ্রেণি
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  লক্ষ্য
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  নিবন্ধিত
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  উৎস
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const node = byId.get(r.location_id);
                const reg = node ? (registered.get(node.path) ?? 0) : null;
                return (
                  <tr
                    key={`${r.location_id}-${r.year}-${r.age_band}`}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-2.5">
                      {node ? pathTrail(node.path, byPath) : "—"}
                      <span className="ml-2 text-xs text-[var(--color-muted)]">
                        {node ? LEVEL_LABEL_BN[node.level] : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{toBn(r.year)}</td>
                    <td className="px-4 py-2.5">{bandLabel.get(r.age_band) ?? r.age_band}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{toBn(r.estimate)}</td>
                    <td className="px-4 py-2.5 text-right text-[var(--color-muted)]">
                      {reg === null ? "—" : toBn(reg)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-muted)]">
                      {r.source}
                      <span className="block">{dateBn(r.updated_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-1 text-lg font-medium">হিসাব যোগ বা সংশোধন করুন</h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          একই এলাকা, বছর ও বয়স শ্রেণির জন্য আবার সংরক্ষণ করলে আগেরটি সংশোধিত হয় — এবং অডিট লগে
          আগের ও পরের দুই মানই থাকে।
        </p>
        <PopulationForm
          locations={nodes.map((n) => ({
            id: n.id,
            depth: nlevel(n.path) - 1,
            label: `${n.name_bn} · ${LEVEL_LABEL_BN[n.level]}`,
          }))}
          defaultYear={year}
        />
      </section>
    </div>
  );
}
