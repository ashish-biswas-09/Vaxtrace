import Link from "next/link";
import { mfaGate, requireAppRole } from "@/lib/auth";
import { dateBn, pctBn, toBn } from "@/lib/format";
import { LEVEL_LABEL_BN, pathTrail, type LocationNode } from "@/lib/locations";
import { coverageTone, dropoutTone } from "@/lib/programme";
import { PageHeader, StatCard, StatusBadge } from "../_components/ui";
import { PrintButton } from "../_components/PrintButton";
import { CoverageFilters } from "./_components/CoverageFilters";
import { TrendBars } from "./_components/TrendBars";

export const dynamic = "force-dynamic";

type Search = {
  area?: string;
  vaccine?: string;
  year?: string;
  from?: string;
  to?: string;
};

// §16.3 — "the screen that changes the defense".
//
// One screen that demonstrates geography, denominators, scoped access, aggregation and
// drill-down simultaneously, because those five things only mean something together. The two
// coverage columns sit side by side deliberately:
//
//   নিবন্ধন-ভিত্তিক  (registry)    of the children this system knows about, how many are up to date
//   জনসংখ্যা-ভিত্তিক (population)  of the children who EXIST here, how many got the final dose
//
// The gap between those two columns is the number the programme is actually judged on, and
// before the denominator existed only the flattering one could be computed.
export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { supabase, claims } = await requireAppRole("supervisor");
  await mfaGate(supabase, claims);

  const sp = await searchParams;
  const year = sp.year ? Number(sp.year) : new Date().getFullYear();

  const [{ data: vaccines }, { data: locations }] = await Promise.all([
    supabase
      .from("vaccines")
      .select("id, code, name_bn, total_doses, is_zero_dose_marker")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("locations")
      .select("id, name_bn, name_en, level, path, parent_id")
      .is("valid_to", null)
      .order("path"),
  ]);

  const nodes = (locations ?? []) as LocationNode[];
  const byPath = new Map(nodes.map((l) => [l.path, l]));

  // The antigen defaults to the zero-dose marker (Penta), because that is the one every
  // immunization programme reports first, and a screen that opens on "all antigens" opens on
  // the one combination where population coverage is undefined.
  const marker = (vaccines ?? []).find((v) => v.is_zero_dose_marker);
  const vaccineId = sp.vaccine === "all" ? null : (sp.vaccine ?? marker?.id ?? null);
  const vaccine = (vaccines ?? []).find((v) => v.id === vaccineId) ?? null;

  const [{ data: rows, error }, { data: trend }] = await Promise.all([
    supabase.rpc("coverage_by_area", {
      p_parent: sp.area ?? null,
      p_vaccine_id: vaccineId,
      p_year: year,
      p_from: sp.from || null,
      p_to: sp.to || null,
    }),
    supabase.rpc("monthly_doses", {
      p_parent: sp.area ?? null,
      p_vaccine_id: vaccineId,
      p_months: 12,
    }),
  ]);

  const areas = rows ?? [];
  const totals = areas.reduce(
    (acc, r) => ({
      registered: acc.registered + Number(r.registered ?? 0),
      target: acc.target + Number(r.target ?? 0),
      doses: acc.doses + Number(r.doses_given ?? 0),
      done: acc.done + Number(r.done_count ?? 0),
      due: acc.due + Number(r.due_count ?? 0),
      final: acc.final + Number(r.final_dose_children ?? 0),
      zero: acc.zero + Number(r.zero_dose ?? 0),
    }),
    { registered: 0, target: 0, doses: 0, done: 0, due: 0, final: 0, zero: 0 },
  );

  const popCoverage = vaccineId && totals.target > 0 ? totals.final / totals.target : null;
  const regCoverage = totals.due > 0 ? totals.done / totals.due : null;

  // The trail is both a breadcrumb and the drill-up control. Each ancestor is a link that
  // re-runs the same query one level higher, which is why the whole screen is driven by
  // searchParams and needs no client state.
  const current = sp.area ? byPath.get(sp.area) : null;
  const crumbs = sp.area
    ? sp.area.split(".").map((_, i, parts) => {
        const prefix = parts.slice(0, i + 1).join(".");
        return { path: prefix, name: byPath.get(prefix)?.name_bn ?? prefix };
      })
    : [];

  const qs = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/admin/coverage${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="এলাকাভিত্তিক কভারেজ"
        description={
          <>
            নিবন্ধন-ভিত্তিক কভারেজ বলে আমাদের নথিভুক্ত শিশুদের কত অংশ সময়মতো টিকা পেয়েছে।
            জনসংখ্যা-ভিত্তিক কভারেজ বলে এলাকায় <em>যত শিশু আছে</em> তার কত অংশ পেয়েছে। দুটির
            পার্থক্যই সেই শিশুরা, যাদের সিস্টেম এখনো চেনে না।
          </>
        }
        actions={<PrintButton label="রিপোর্ট ছাপুন" />}
      />

      {/* On paper the filters are gone, so the sheet has to say what it is. */}
      <div className="print-only text-sm">
        <p>
          <strong>এলাকা:</strong> {sp.area ? pathTrail(sp.area, byPath) : "সমগ্র দায়িত্বাধীন এলাকা"} ·{" "}
          <strong>টিকা:</strong> {vaccine?.name_bn ?? "সব টিকা"} · <strong>হর-বছর:</strong>{" "}
          {toBn(year)}
          {sp.from && ` · ডোজের সময়কাল: ${dateBn(sp.from)} – ${dateBn(sp.to ?? "")}`}
        </p>
      </div>

      <CoverageFilters
        vaccines={(vaccines ?? []).map((v) => ({ id: v.id, label: `${v.name_bn} (${v.code})` }))}
        current={{
          area: sp.area ?? "",
          vaccine: vaccineId ?? "all",
          year: String(year),
          from: sp.from ?? "",
          to: sp.to ?? "",
        }}
      />

      <nav aria-label="এলাকার স্তর" className="flex flex-wrap items-center gap-1 text-sm">
        <Link href={qs({ area: undefined })} className="text-[var(--color-primary)]">
          সব
        </Link>
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1">
            <span className="text-[var(--color-muted)]">›</span>
            {i === crumbs.length - 1 ? (
              <span className="font-medium">{c.name}</span>
            ) : (
              <Link href={qs({ area: c.path })} className="text-[var(--color-primary)]">
                {c.name}
              </Link>
            )}
          </span>
        ))}
        {current && (
          <span className="ml-1 text-xs text-[var(--color-muted)]">
            ({LEVEL_LABEL_BN[current.level]})
          </span>
        )}
      </nav>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="লক্ষ্য শিশু (হর)"
          value={totals.target > 0 ? toBn(totals.target) : "—"}
          hint={
            totals.target > 0
              ? `${toBn(year)} সালের জীবিত শিশু অনুমান`
              : "এই এলাকার জন্য জনসংখ্যার হিসাব যোগ করা হয়নি"
          }
        />
        <StatCard
          label="নিবন্ধিত শিশু"
          value={toBn(totals.registered)}
          tone="success"
          hint={
            totals.target > 0
              ? `লক্ষ্যের ${pctBn(totals.registered / totals.target)} নিবন্ধিত`
              : "হর ছাড়া তুলনা করা যায় না"
          }
        />
        <StatCard
          label={vaccine ? `জনসংখ্যা-ভিত্তিক কভারেজ · ${vaccine.name_bn}` : "জনসংখ্যা-ভিত্তিক কভারেজ"}
          value={pctBn(popCoverage)}
          tone={coverageTone(popCoverage)}
          hint={
            vaccine
              ? `${toBn(totals.final)} / ${toBn(totals.target)} — শেষ ডোজ সম্পন্ন`
              : "একটি নির্দিষ্ট টিকা বেছে নিলে এই হিসাব সম্ভব"
          }
        />
        <StatCard
          label="শূন্য-ডোজ শিশু"
          value={toBn(totals.zero)}
          tone={totals.zero > 0 ? "danger" : "success"}
          href="/admin/zero-dose"
          hint="১২–২৩ মাস বয়সী, যারা পেন্টা-১ কখনো পায়নি"
        />
      </section>

      {totals.target === 0 && (
        <p
          role="status"
          className="rounded-md border border-[var(--color-warning)] px-4 py-3 text-sm text-[var(--color-warning)] print:hidden"
        >
          এই এলাকার জন্য {toBn(year)} সালের জনসংখ্যার হিসাব নেই, তাই জনসংখ্যা-ভিত্তিক কভারেজের
          ঘরগুলো &ldquo;—&rdquo; দেখাচ্ছে।{" "}
          <Link href="/admin/population" className="underline">
            হর যোগ করুন
          </Link>
          {" "}— তার আগে পর্যন্ত এখানে শুধু নিবন্ধন-ভিত্তিক হিসাব পাওয়া যাবে।
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          কভারেজের হিসাব আনা যায়নি: {error.message}
        </p>
      )}

      <section className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full min-w-[62rem] text-sm">
          <caption className="sr-only">
            এলাকা অনুযায়ী নিবন্ধন, লক্ষ্য, প্রদত্ত ডোজ ও কভারেজ
          </caption>
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">এলাকা</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">নিবন্ধিত</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">লক্ষ্য</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">প্রদত্ত ডোজ</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">নিবন্ধন-ভিত্তিক</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">জনসংখ্যা-ভিত্তিক</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">ড্রপআউট</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">শূন্য-ডোজ</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((r) => {
              const hasChildren = nodes.some((n) => n.parent_id === r.location_id);
              return (
                <tr key={r.location_id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2.5">
                    {hasChildren ? (
                      <Link href={qs({ area: r.location_path })} className="text-[var(--color-primary)]">
                        {r.name_bn}
                      </Link>
                    ) : (
                      r.name_bn
                    )}
                    <span className="ml-2 text-xs text-[var(--color-muted)]">
                      {LEVEL_LABEL_BN[r.level]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {/* Every count is a link into the rows behind it — the audit's rule that a
                        KPI must not be a dead end applies to a table cell too. */}
                    <Link href="/admin/children" className="hover:underline">
                      {toBn(r.registered)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-muted)]">
                    {r.target > 0 ? toBn(r.target) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{toBn(r.doses_given)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <StatusBadge tone={coverageTone(r.registry_coverage)}>
                      {pctBn(r.registry_coverage)}
                    </StatusBadge>
                    <span className="ml-2 text-xs text-[var(--color-muted)]">
                      {toBn(r.done_count)}/{toBn(r.due_count)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <StatusBadge tone={coverageTone(r.population_coverage)}>
                      {pctBn(r.population_coverage)}
                    </StatusBadge>
                    {r.target > 0 && vaccineId && (
                      <span className="ml-2 text-xs text-[var(--color-muted)]">
                        {toBn(r.final_dose_children)}/{toBn(r.target)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <StatusBadge tone={dropoutTone(r.dropout_rate)}>
                      {pctBn(r.dropout_rate)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.zero_dose > 0 ? (
                      <Link
                        href={`/admin/zero-dose?area=${r.location_path}`}
                        className="text-[var(--color-danger)] hover:underline"
                      >
                        {toBn(r.zero_dose)}
                      </Link>
                    ) : (
                      toBn(0)
                    )}
                  </td>
                </tr>
              );
            })}
            {areas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  এই স্তরে কোনো এলাকা নেই।
                </td>
              </tr>
            )}
          </tbody>
          {areas.length > 0 && (
            <tfoot className="border-t-2 border-[var(--color-border)] font-medium">
              <tr>
                <td className="px-4 py-3">মোট</td>
                <td className="px-4 py-3 text-right tabular-nums">{toBn(totals.registered)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {totals.target > 0 ? toBn(totals.target) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{toBn(totals.doses)}</td>
                <td className="px-4 py-3 text-right">{pctBn(regCoverage)}</td>
                <td className="px-4 py-3 text-right">{pctBn(popCoverage)}</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right tabular-nums">{toBn(totals.zero)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-1 text-lg font-medium">গত ১২ মাসে প্রদত্ত ডোজ</h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          সময়ের মাত্রা ছাড়া কভারেজ কেবল বাড়তে পারে, কমতে পারে না — তাই খারাপ হতে থাকা কর্মসূচি
          ধরা পড়ে না।
        </p>
        <TrendBars rows={(trend ?? []).map((t) => ({ month: t.month, doses: Number(t.doses) }))} />
      </section>
    </div>
  );
}
