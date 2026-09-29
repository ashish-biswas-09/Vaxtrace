import Link from "next/link";
import { appRoleAtLeast, requireAppRole } from "@/lib/auth";
import { parseCoverageParams } from "@/lib/coverageParams";
import { dateBn, dateTimeBn, pctBn, toBn } from "@/lib/format";
import { LEVEL_LABEL_BN, pathTrail, type LocationNode } from "@/lib/locations";
import { coverageTone, dropoutTone } from "@/lib/programme";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui/kit";
import { Callout } from "../_components/Callout";
import { PrintButton } from "../_components/PrintButton";
import { CoverageFilters } from "./_components/CoverageFilters";
import { TrendBars, fillMonths, lastMonths } from "./_components/TrendBars";
export const metadata = { title: "এলাকাভিত্তিক কভারেজ" };

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

// §16.3 — "the screen that changes the defense".
//
// One screen that demonstrates geography, denominators, scoped access, aggregation and
// drill-down simultaneously, because those five things only mean something together. The two
// coverage columns sit side by side deliberately:
//
//   নিবন্ধন-ভিত্তিক  (registry)    of the children this system knows about, how many are up to date
//   জনসংখ্যা-ভিত্তিক (population)  of the children who EXIST here, how many got the final dose
//
// The gap between those two columns is the number the programme is actually judged on.
export default async function CoveragePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase, claims } = await requireAppRole("supervisor");
  const isManager = appRoleAtLeast(claims.appRole, "programme_manager");

  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const p = parseCoverageParams(sp, thisYear);
  const year = p.year;

  // Population coverage divides final doses by ONE year's surviving infants, so the doses it
  // counts have to come from that year too. With no window chosen the window is the
  // denominator year, not all time — otherwise several birth cohorts are divided by one (K-13).
  const from = p.from ?? `${year}-01-01`;
  const to = p.to ?? `${year}-12-31`;

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
  const vaccineId = p.vaccine === "all" ? null : (p.vaccine ?? marker?.id ?? null);
  const vaccine = (vaccines ?? []).find((v) => v.id === vaccineId) ?? null;

  const byArea = (window: boolean) =>
    supabase.rpc("coverage_by_area", {
      p_parent: p.area,
      p_vaccine_id: vaccineId,
      p_year: year,
      p_from: window ? from : null,
      p_to: window ? to : null,
    });
  // Dropout is a cohort measure — of the children who started, how many finished — so it is
  // read from all doses to date. Inside a calendar window it goes negative: children finishing
  // this year mostly started last year.
  const [{ data: rows, error }, { data: cohort }, { data: trend }, { data: job }] = await Promise.all([
    byArea(true),
    byArea(false),
    supabase.rpc("monthly_doses", { p_parent: p.area, p_vaccine_id: vaccineId, p_months: 12 }),
    // The trend reads a nightly materialized view; say how fresh it is, so "no doses in
    // August" and "not refreshed since July" cannot be mistaken for each other. Empty for a
    // role that cannot read job health — the line is then simply omitted.
    supabase
      .from("v_job_health")
      .select("last_success_at, is_stale")
      .eq("job_name", "refresh-coverage-monthly")
      .maybeSingle(),
  ]);
  if (error) console.error("coverage_by_area", error);
  const cohortBy = new Map((cohort ?? []).map((c) => [c.location_id, c]));

  const all = rows ?? [];
  // Areas with nothing in them are listed once under the table rather than as rows of zeros
  // and dashes that bury the one area that has data.
  const areas = all.filter((r) => r.registered > 0 || r.target > 0 || r.doses_given > 0);
  const empty = all.filter((r) => !areas.includes(r));

  const totals = all.reduce(
    (acc, r) => ({
      registered: acc.registered + Number(r.registered ?? 0),
      target: acc.target + Number(r.target ?? 0),
      doses: acc.doses + Number(r.doses_given ?? 0),
      done: acc.done + Number(r.done_count ?? 0),
      due: acc.due + Number(r.due_count ?? 0),
      dose1: acc.dose1 + Number(r.dose1_children ?? 0),
      final: acc.final + Number(r.final_dose_children ?? 0),
      zero: acc.zero + Number(r.zero_dose ?? 0),
    }),
    { registered: 0, target: 0, doses: 0, done: 0, due: 0, dose1: 0, final: 0, zero: 0 },
  );

  const popCoverage = vaccineId && totals.target > 0 ? totals.final / totals.target : null;
  const regCoverage = totals.due > 0 ? totals.done / totals.due : null;
  const cohortTotals = (cohort ?? []).reduce(
    (acc, c) => ({ dose1: acc.dose1 + Number(c.dose1_children ?? 0), final: acc.final + Number(c.final_dose_children ?? 0) }),
    { dose1: 0, final: 0 },
  );
  const totalDropout =
    vaccineId && cohortTotals.dose1 > 0
      ? (cohortTotals.dose1 - cohortTotals.final) / cohortTotals.dose1
      : null;

  // The trail is both a breadcrumb and the drill-up control. Each ancestor is a link that
  // re-runs the same query one level higher, which is why the whole screen is driven by
  // searchParams and needs no client state.
  const current = p.area ? byPath.get(p.area) : null;
  const crumbs = p.area
    ? p.area.split(".").map((_, i, parts) => {
        const prefix = parts.slice(0, i + 1).join(".");
        return { path: prefix, name: byPath.get(prefix)?.name_bn ?? prefix };
      })
    : [];

  const valid = { area: p.area, vaccine: p.vaccine, year: sp.year ? String(year) : null, from: p.from, to: p.to };
  const qs = (over: Partial<typeof valid>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...valid, ...over })) if (v) q.set(k, String(v));
    return `/admin/coverage${q.size ? `?${q}` : ""}`;
  };
  const areaQs = (path: string | null) => (path ? `&area=${encodeURIComponent(path)}` : "");

  const markerName = marker?.name_bn ?? "মার্কার টিকা";
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];
  const muted = "text-xs text-[var(--text-muted)]";
  const sticky = "sticky left-0 bg-[var(--surface)]";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="এলাকাভিত্তিক কভারেজ"
        description="এলাকা অনুযায়ী টিকার কভারেজ। এলাকার নামে ক্লিক করলে নিচের স্তর দেখা যাবে।"
        actions={<PrintButton />}
      />

      <details className="-mt-3 text-sm text-[var(--text-secondary)] print:hidden">
        <summary className="cursor-pointer text-[var(--accent)]">হিসাব কীভাবে?</summary>
        <p className="mt-2 max-w-3xl">
          <strong>নিবন্ধন-ভিত্তিক:</strong> নিবন্ধিত শিশুদের যেসব ডোজের সময় হয়েছে, তার কত শতাংশ
          দেওয়া হয়েছে। <strong>জনসংখ্যা-ভিত্তিক:</strong> এলাকার লক্ষ্য শিশুদের কত শতাংশ শেষ ডোজ
          পেয়েছে। দুটির পার্থক্য দেখায় কত শিশু এখনো নিবন্ধনের বাইরে।
        </p>
      </details>

      {/* On paper the filters are gone, so the sheet has to say what it is. */}
      <div className="print-only text-sm">
        <p>
          <strong>এলাকা:</strong> {p.area ? pathTrail(p.area, byPath) : "সমগ্র দায়িত্বাধীন এলাকা"} ·{" "}
          <strong>টিকা:</strong> {vaccine?.name_bn ?? "সব টিকা"} · <strong>লক্ষ্য শিশুর বছর:</strong>{" "}
          {toBn(year)} · <strong>ডোজের সময়কাল:</strong> {dateBn(from)} – {dateBn(to)}
        </p>
      </div>

      {p.invalid && (
        <Callout tone="warning" title="ফিল্টারের একটি মান সঠিক ছিল না">
          সেই মানের বদলে সাধারণ মান দেখানো হচ্ছে। শেষের তারিখ শুরুর তারিখের পরে হতে হবে।
        </Callout>
      )}

      <CoverageFilters
        vaccines={(vaccines ?? []).map((v) => ({ id: v.id, label: `${v.name_bn} (${v.code})` }))}
        years={years}
        current={{
          area: p.area ?? "",
          vaccine: vaccineId ?? "all",
          year: String(year),
          from: p.from ?? "",
          to: p.to ?? "",
        }}
      />
      {!p.from && !p.to && (
        <p className={`-mt-3 ${muted} print:hidden`}>
          ডোজের তারিখ না দিলে {toBn(year)} সালে দেওয়া ডোজ গণনা হয় ({dateBn(from)} – {dateBn(to)})।
        </p>
      )}

      <nav aria-label="এলাকার স্তর" className="flex flex-wrap items-center gap-1 text-sm">
        <Link href={qs({ area: null })} className="text-[var(--accent)]">
          সব এলাকা
        </Link>
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1">
            <span className="text-[var(--text-muted)]">›</span>
            {i === crumbs.length - 1 ? (
              <span className="font-medium">{c.name}</span>
            ) : (
              <Link href={qs({ area: c.path })} className="text-[var(--accent)]">
                {c.name}
              </Link>
            )}
          </span>
        ))}
        {current && <span className={`ml-1 ${muted}`}>({LEVEL_LABEL_BN[current.level]})</span>}
      </nav>

      {error ? (
        <Callout tone="danger" title="কভারেজের হিসাব দেখানো যাচ্ছে না">
          ফিল্টারগুলো ঠিক আছে কিনা দেখে আবার চেষ্টা করুন।
        </Callout>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="লক্ষ্য শিশু"
              value={totals.target > 0 ? toBn(totals.target) : "—"}
              hint={
                totals.target > 0
                  ? `${toBn(year)} সালের জীবিত শিশুর অনুমান`
                  : "এই এলাকার জনসংখ্যার হিসাব যোগ করা হয়নি"
              }
            />
            <StatCard
              label="নিবন্ধিত শিশু"
              value={toBn(totals.registered)}
              tone="success"
              hint={
                totals.target > 0
                  ? `লক্ষ্যের ${pctBn(totals.registered / totals.target)} নিবন্ধিত`
                  : "জনসংখ্যার হিসাব নেই, তাই তুলনা করা যাচ্ছে না"
              }
            />
            <StatCard
              label={vaccine ? `জনসংখ্যা-ভিত্তিক কভারেজ · ${vaccine.name_bn}` : "জনসংখ্যা-ভিত্তিক কভারেজ"}
              value={pctBn(popCoverage)}
              tone={coverageTone(popCoverage)}
              hint={
                vaccine
                  ? `${toBn(totals.final)} / ${toBn(totals.target)} শিশু শেষ ডোজ পেয়েছে`
                  : "একটি টিকা বেছে নিলে এই হিসাব দেখা যাবে"
              }
            />
            <StatCard
              label="শূন্য-ডোজ (১২–২৩ মাস)"
              value={toBn(totals.zero)}
              tone={totals.zero > 0 ? "danger" : "success"}
              href={`/admin/zero-dose?window=12-23${areaQs(p.area)}`}
              hint={`${markerName}-এর প্রথম ডোজ কখনো পায়নি`}
            />
          </section>

          {totals.target === 0 && (
            <Callout
              tone="warning"
              title={`এই এলাকার ${toBn(year)} সালের জনসংখ্যার হিসাব নেই`}
              href={isManager ? "/admin/population" : undefined}
              hrefLabel="জনসংখ্যার হিসাব যোগ করুন"
            >
              তাই জনসংখ্যা-ভিত্তিক কভারেজ “—” দেখাচ্ছে। নিবন্ধন-ভিত্তিক হিসাব দেখা যাবে।
            </Callout>
          )}

          <p className={`${muted} md:hidden print:hidden`}>বাকি কলাম দেখতে টেবিলটি বাঁয়ে সরান →</p>
          <section className="overflow-x-auto rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)]">
            <table className="w-full min-w-[62rem] text-sm">
              <caption className="sr-only">এলাকা অনুযায়ী নিবন্ধন, লক্ষ্য, প্রদত্ত ডোজ ও কভারেজ</caption>
              <thead className="bg-[var(--surface-raised)] text-left text-[var(--text-secondary)]">
                <tr>
                  <th scope="col" className={`px-4 py-3 font-medium ${sticky} bg-[var(--surface-raised)]`}>
                    এলাকা
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">নিবন্ধিত</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">লক্ষ্য</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">প্রদত্ত ডোজ*</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">নিবন্ধন-ভিত্তিক</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">জনসংখ্যা-ভিত্তিক*</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">ড্রপআউট</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">শূন্য-ডোজ</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((r) => {
                  const hasChildren = nodes.some((n) => n.parent_id === r.location_id);
                  return (
                    <tr key={r.location_id} className="border-t border-[var(--border-subtle)]">
                      <td className={`px-4 py-2.5 ${sticky}`}>
                        {hasChildren ? (
                          <Link href={qs({ area: r.location_path })} className="text-[var(--accent)]">
                            {r.name_bn}
                          </Link>
                        ) : (
                          r.name_bn
                        )}
                        <span className={`ml-2 ${muted}`}>{LEVEL_LABEL_BN[r.level]}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {/* A count is a link into the rows behind it, filtered to the same
                            area and the same definition (active, not deleted). */}
                        {isManager ? (
                          <Link
                            href={`/admin/children?status=active${areaQs(r.location_path)}`}
                            className="hover:underline"
                          >
                            {toBn(r.registered)}
                          </Link>
                        ) : (
                          toBn(r.registered)
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">
                        {r.target > 0 ? toBn(r.target) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{toBn(r.doses_given)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <Rate rate={r.registry_coverage} tone={coverageTone(r.registry_coverage)} />
                        <span className={`ml-2 ${muted}`}>
                          {toBn(r.done_count)}/{toBn(r.due_count)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <Rate rate={r.population_coverage} tone={coverageTone(r.population_coverage)} />
                        {r.target > 0 && vaccineId && (
                          <span className={`ml-2 ${muted}`}>
                            {toBn(r.final_dose_children)}/{toBn(r.target)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Rate
                          rate={cohortBy.get(r.location_id)?.dropout_rate ?? null}
                          tone={dropoutTone(cohortBy.get(r.location_id)?.dropout_rate)}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {r.zero_dose > 0 ? (
                          <Link
                            href={`/admin/zero-dose?window=12-23${areaQs(r.location_path)}`}
                            className="text-[var(--danger)] hover:underline"
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
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                      এই স্তরের কোনো এলাকায় এখনো তথ্য নেই।
                    </td>
                  </tr>
                )}
              </tbody>
              {areas.length > 0 && (
                <tfoot className="border-t-2 border-[var(--border-default)] font-medium">
                  <tr>
                    <td className={`px-4 py-3 ${sticky}`}>মোট</td>
                    <td className="px-4 py-3 text-right tabular-nums">{toBn(totals.registered)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totals.target > 0 ? toBn(totals.target) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{toBn(totals.doses)}</td>
                    <td className="px-4 py-3 text-right">{pctBn(regCoverage)}</td>
                    <td className="px-4 py-3 text-right">{pctBn(popCoverage)}</td>
                    <td className="px-4 py-3 text-right">{pctBn(totalDropout)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{toBn(totals.zero)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>
          <p className={muted}>
            * তারিখ-নির্ভর: {dateBn(from)} – {dateBn(to)} সময়ের ডোজ। ড্রপআউট এখন পর্যন্ত সব ডোজ থেকে;
            বাকি কলাম আজকের অবস্থা।
          </p>

          {empty.length > 0 && (
            <p className="text-sm text-[var(--text-secondary)]">
              তথ্য নেই এমন এলাকা ({toBn(empty.length)}):{" "}
              {empty.map((r, i) => (
                <span key={r.location_id}>
                  {i > 0 && ", "}
                  <Link href={qs({ area: r.location_path })} className="text-[var(--accent)]">
                    {r.name_bn}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </>
      )}

      <section className="rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-5">
        <h2 className="mb-1 text-lg font-medium">গত ১২ মাসে প্রদত্ত ডোজ</h2>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          মাসভিত্তিক প্রদত্ত ডোজ। কোনো মাসে ডোজ কমে গেলে সেই মাসের সেশনগুলো দেখুন।
          {job && (
            <span className={`ml-1 ${job.is_stale ? "text-[var(--warning)]" : ""}`}>
              তথ্য হালনাগাদ:{" "}
              {job.last_success_at ? dateTimeBn(job.last_success_at) : "এখনো হয়নি"}
              {job.is_stale ? " (পুরোনো)" : ""}
            </span>
          )}
        </p>
        <TrendBars
          caption="গত ১২ মাসে মাসভিত্তিক প্রদত্ত ডোজ"
          rows={fillMonths(
            (trend ?? []).map((t) => ({ month: t.month, doses: Number(t.doses) })),
            lastMonths(12),
          )}
        />
      </section>
    </div>
  );
}

// A rate with no denominator is a plain dash, not a grey badge that reads like a status.
function Rate({ rate, tone }: { rate: number | null; tone: Parameters<typeof StatusBadge>[0]["tone"] }) {
  if (rate == null) return <span className="text-[var(--text-muted)]">—</span>;
  return <StatusBadge tone={tone}>{pctBn(rate)}</StatusBadge>;
}
