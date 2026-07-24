import { requireRole } from "@/lib/auth";
import { pctBn, toBn, dateBn } from "@/lib/format";

export const dynamic = "force-dynamic";

// Lightweight CSS bars — no chart dependency (Recharts would be ~100KB for six horizontal
// bars). Width encodes the value; label sits inside/next to the fill.
function Bar({ ratio, tone }: { ratio: number; tone: string }) {
  return (
    <div className="h-6 w-full overflow-hidden rounded bg-[var(--color-border)]/40">
      <div
        className="h-full rounded"
        style={{ width: `${Math.max(2, Math.round(ratio * 100))}%`, background: tone }}
      />
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await requireRole("admin");
  const [{ data: coverage }, { data: dropout }, { data: daily }] = await Promise.all([
    supabase.from("v_coverage").select("code, name_bn, coverage_rate").order("code"),
    supabase.from("v_dropout").select("code, started, completed").order("code"),
    supabase.from("mv_daily_doses").select("administered_date, doses").order("administered_date"),
  ]);

  const maxDaily = Math.max(1, ...(daily ?? []).map((d) => d.doses ?? 0));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">কভারেজ বিশ্লেষণ</h1>
        <p className="text-sm text-[var(--color-muted)]">টিকাভিত্তিক কভারেজ ও ড্রপআউট চিত্র</p>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-4 text-lg font-medium">টিকা কভারেজ</h2>
        <div className="flex flex-col gap-4">
          {(coverage ?? []).map((r) => (
            <div key={r.code} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
              <span className="truncate">{r.name_bn}</span>
              <Bar
                ratio={r.coverage_rate ?? 0}
                tone={
                  (r.coverage_rate ?? 0) >= 0.8
                    ? "var(--color-success)"
                    : (r.coverage_rate ?? 0) >= 0.5
                      ? "var(--color-warning)"
                      : "var(--color-danger)"
                }
              />
              <span className="text-right tabular-nums">{pctBn(r.coverage_rate)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-4 text-lg font-medium">ড্রপআউট (শুরু বনাম সম্পূর্ণ)</h2>
        <div className="flex flex-col gap-4">
          {(dropout ?? []).map((r) => {
            const started = r.started ?? 0;
            const completed = r.completed ?? 0;
            return (
              <div key={r.code} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-sm">
                <span className="truncate font-mono text-xs">{r.code}</span>
                <Bar ratio={started ? completed / started : 0} tone="var(--color-primary)" />
                <span className="text-right text-xs text-[var(--color-muted)]">
                  {toBn(completed)}/{toBn(started)}
                </span>
              </div>
            );
          })}
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
                  title={`${d.doses} doses`}
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
