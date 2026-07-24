import { requireRole } from "@/lib/auth";
import { pctBn, toBn, dateBn } from "@/lib/format";
import { StatusBadge } from "../_components/ui";
import { CoverageBars, type CoverageRow } from "../_components/Chart";
import { PrintButton } from "./_components/PrintButton";

export const dynamic = "force-dynamic";

// Reports + analytics unified here (audit C4 — the two competing analytics IAs were tech debt).
export default async function ReportsPage() {
  const supabase = await requireRole("admin");
  const [{ data: coverage }, { data: dropout }, { data: daily }] = await Promise.all([
    supabase.from("v_coverage").select("code, name_bn, coverage_rate").order("code"),
    supabase.from("v_dropout").select("code, started, completed").order("code"),
    supabase.from("mv_daily_doses").select("administered_date, doses").order("administered_date"),
  ]);

  const maxDaily = Math.max(1, ...(daily ?? []).map((d) => d.doses ?? 0));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">রিপোর্ট ও পরিসংখ্যান</h1>
          <p className="text-sm text-[var(--color-muted)]">টিকা কভারেজ ও ড্রপআউট বিশ্লেষণ</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <a
            href="/admin/reports/export"
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
          >
            CSV ডাউনলোড
          </a>
          <PrintButton />
        </div>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-4 text-lg font-medium">টিকাভিত্তিক কভারেজ</h2>
        <CoverageBars rows={(coverage ?? []) as CoverageRow[]} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">কভারেজ (বিস্তারিত)</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">কোড</th>
                <th className="px-4 py-3 font-medium">টিকা</th>
                <th className="px-4 py-3 text-right font-medium">কভারেজ</th>
              </tr>
            </thead>
            <tbody>
              {(coverage ?? []).map((r) => (
                <tr key={r.code} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3">{r.name_bn}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge
                      tone={
                        r.coverage_rate == null
                          ? "muted"
                          : r.coverage_rate >= 0.8
                            ? "success"
                            : r.coverage_rate >= 0.5
                              ? "warning"
                              : "danger"
                      }
                    >
                      {pctBn(r.coverage_rate)}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">ড্রপআউট</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">কোড</th>
                <th className="px-4 py-3 text-right font-medium">শুরু করেছে</th>
                <th className="px-4 py-3 text-right font-medium">সম্পূর্ণ করেছে</th>
                <th className="px-4 py-3 text-right font-medium">ড্রপআউট হার</th>
              </tr>
            </thead>
            <tbody>
              {(dropout ?? []).map((r) => {
                const started = r.started ?? 0;
                const completed = r.completed ?? 0;
                const rate = started ? 1 - completed / started : null;
                return (
                  <tr key={r.code} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{toBn(started)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{toBn(completed)}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge tone={rate != null && rate > 0.1 ? "danger" : "success"}>
                        {pctBn(rate)}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-4 text-lg font-medium">দৈনিক প্রদত্ত ডোজ</h2>
        {daily && daily.length > 0 ? (
          <div className="flex h-40 items-end gap-2">
            {daily.map((d) => (
              <div key={d.administered_date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[var(--color-primary)]"
                  style={{ height: `${Math.round(((d.doses ?? 0) / maxDaily) * 100)}%` }}
                  title={`${d.doses}`}
                />
                <span className="text-[10px] text-[var(--color-muted)]">
                  {dateBn(d.administered_date).slice(0, 5)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">কোনো তথ্য নেই।</p>
        )}
      </section>
    </div>
  );
}
