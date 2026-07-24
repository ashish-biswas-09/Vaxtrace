import { requireRole } from "@/lib/auth";
import { pctBn, toBn } from "@/lib/format";
import { StatusBadge } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await requireRole("admin");
  const [{ data: coverage }, { data: dropout }] = await Promise.all([
    supabase.from("v_coverage").select("code, name_bn, coverage_rate").order("code"),
    supabase.from("v_dropout").select("code, started, completed").order("code"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">রিপোর্ট ও পরিসংখ্যান</h1>
          <p className="text-sm text-[var(--color-muted)]">টিকা কভারেজ ও ড্রপআউট বিশ্লেষণ</p>
        </div>
        <a
          href="/admin/reports/export"
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
        >
          CSV ডাউনলোড
        </a>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">টিকা কভারেজ</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">কোড</th>
                <th className="px-4 py-3 font-medium">টিকা</th>
                <th className="px-4 py-3 font-medium">কভারেজ</th>
              </tr>
            </thead>
            <tbody>
              {(coverage ?? []).map((r) => (
                <tr key={r.code} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3">{r.name_bn}</td>
                  <td className="px-4 py-3">
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
                <th className="px-4 py-3 font-medium">শুরু করেছে</th>
                <th className="px-4 py-3 font-medium">সম্পূর্ণ করেছে</th>
                <th className="px-4 py-3 font-medium">ড্রপআউট হার</th>
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
                    <td className="px-4 py-3">{toBn(started)}</td>
                    <td className="px-4 py-3">{toBn(completed)}</td>
                    <td className="px-4 py-3">
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
    </div>
  );
}
