import { requireAppRole } from "@/lib/auth";
import { pctBn, toBn } from "@/lib/format";
import { selectAll } from "@/lib/paged";
import { dropoutTone } from "@/lib/programme";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/kit";
import { DownloadIcon } from "@/components/icons";
import { buildWindow, daily, windowDates } from "../_queries";
import { Callout } from "../_components/Callout";
import { CoverageBars, TrendArea, type CoverageRow } from "../_components/Chart";
import { PrintButton } from "../_components/PrintButton";
import { RANGES, rangeDays } from "../_components/ranges";
export const metadata = { title: "রিপোর্ট" };

export const dynamic = "force-dynamic";

// Reports + analytics unified here (audit C4 — the two competing analytics IAs were tech debt).
//
// Coverage and dropout are cohort figures — "of everyone due so far" — so the top-bar period
// picker scopes the daily-dose series only, and the page says so rather than implying a
// seven-day coverage figure (K-11). Every read is the caller's own RLS-scoped client, so a
// supervisor sees their area and a national manager the country.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { supabase } = await requireAppRole("supervisor");
  const { range } = await searchParams;
  const w = buildWindow(rangeDays(range));
  const rangeLabel = RANGES.find((r) => r.days === w.days)?.label ?? "";

  const [coverage, dropout, vaccines, doses] = await Promise.all([
    supabase
      .from("v_coverage")
      .select("code, name_bn, coverage_rate, done_count, due_count")
      .order("code"),
    supabase.from("v_dropout").select("code, name_bn, started, completed, dropout_rate").order("code"),
    supabase.from("vaccines").select("code, total_doses"),
    // The daily series used to read mv_daily_doses, which is (rightly) not granted to signed-in
    // users — a materialized view has no RLS — so the chart was always empty (K-03). The dose
    // rows themselves are RLS-scoped; the window keeps the read small.
    selectAll(() =>
      supabase
        .from("vaccination_records")
        .select("administered_date")
        .is("voided_at", null)
        .gte("administered_date", w.start)
        .lte("administered_date", w.end)
        .order("administered_date"),
    ),
  ]);
  for (const r of [coverage, dropout]) if (r.error) console.error("reports", r.error);

  // Dropout needs a first and a last dose; for a single-dose antigen it is ০% by definition and
  // only adds noise.
  const multiDose = new Set(
    (vaccines.data ?? []).filter((v) => (v.total_doses ?? 1) > 1).map((v) => v.code),
  );
  const dropoutRows = (dropout.data ?? []).filter((r) => r.code && multiDose.has(r.code));
  const series = daily(doses.map((d) => d.administered_date), w);
  const cov = (coverage.data ?? []) as CoverageRow[];

  const th = "px-4 py-3 font-medium";
  const td = "px-4 py-3";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="রিপোর্ট"
        description="টিকাভিত্তিক কভারেজ, ড্রপআউট ও দৈনিক প্রদত্ত ডোজ — আপনার দায়িত্বাধীন এলাকার।"
        actions={
          <>
            {/* A plain anchor, not a client-side <Link>: the target is a file download. */}
            <a
              href="/admin/reports/export"
              download
              className="inline-flex h-10 items-center gap-2 rounded-[var(--r-md)] border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
            >
              <DownloadIcon size={16} />
              CSV ডাউনলোড
            </a>
            <PrintButton />
          </>
        }
      />

      <section className="rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-5">
        <h2 className="mb-4 text-lg font-medium">টিকাভিত্তিক কভারেজ</h2>
        {coverage.error ? (
          <Callout tone="danger" title="কভারেজের হিসাব দেখানো যাচ্ছে না">
            একটু পরে আবার চেষ্টা করুন।
          </Callout>
        ) : (
          // The bars carry the rate, the numerator and the denominator, so the detailed table
          // that repeated them row for row is gone.
          cov.length === 0 ? (
            <EmptyState title="কভারেজের কোনো তথ্য নেই" hint="নিবন্ধিত শিশুর কোনো ডোজের সময় এখনো হয়নি।" />
          ) : (
            <CoverageBars rows={cov} />
          )
        )}
      </section>


      <section>
        <h2 className="mb-1 text-lg font-medium">ড্রপআউট</h2>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
          প্রথম ডোজ পাওয়া শিশুদের কত অংশ শেষ ডোজ পায়নি। একক ডোজের টিকা এখানে নেই।
        </p>
        {dropout.error ? (
          <Callout tone="danger" title="ড্রপআউটের হিসাব দেখানো যাচ্ছে না">
            একটু পরে আবার চেষ্টা করুন।
          </Callout>
        ) : dropoutRows.length === 0 ? (
          <EmptyState title="ড্রপআউটের কোনো তথ্য নেই" hint="একাধিক ডোজের কোনো টিকার প্রথম ডোজ এখনো দেওয়া হয়নি।" />
        ) : (
          <div className="overflow-x-auto rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)]">
            <table className="w-full text-sm">
              <caption className="sr-only">টিকা অনুযায়ী ড্রপআউট</caption>
              <thead className="bg-[var(--surface-raised)] text-left text-[var(--text-secondary)]">
                <tr>
                  <th scope="col" className={th}>টিকা</th>
                  <th scope="col" className={`${th} text-right`}>প্রথম ডোজ পেয়েছে</th>
                  <th scope="col" className={`${th} text-right`}>শেষ ডোজ পেয়েছে</th>
                  <th scope="col" className={`${th} text-right`}>ড্রপআউট হার</th>
                </tr>
              </thead>
              <tbody>
                {dropoutRows.map((r) => (
                  <tr key={r.code} className="border-t border-[var(--border-subtle)]">
                    <td className={td}>
                      {r.name_bn} <span className="font-mono text-xs text-[var(--text-muted)]">{r.code}</span>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{toBn(r.started ?? 0)}</td>
                    <td className={`${td} text-right tabular-nums`}>{toBn(r.completed ?? 0)}</td>
                    <td className={`${td} text-right`}>
                      <StatusBadge tone={dropoutTone(r.dropout_rate)}>{pctBn(r.dropout_rate)}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-5">
        <h2 className="mb-1 text-lg font-medium">দৈনিক প্রদত্ত ডোজ</h2>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          {rangeLabel} · মোট {toBn(series.reduce((a, b) => a + b, 0))} ডোজ। সময়সীমা ওপরের বাছাই থেকে বদলানো যায়।
        </p>
        <TrendArea points={series} labels={windowDates(w)} caption={`দৈনিক প্রদত্ত ডোজ, ${rangeLabel}`} />
      </section>
    </div>
  );
}
