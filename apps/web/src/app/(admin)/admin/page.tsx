import { requireRole } from "@/lib/auth";
import { pctBn, toBn, dateBn } from "@/lib/format";
import { StatCard, StatusBadge } from "./_components/ui";
import { auditLabel } from "./_audit";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await requireRole("admin");

  const [{ data: cov }, { data: drop }, usersRes, lowStockRes, { data: audit }] =
    await Promise.all([
      supabase.from("v_coverage").select("coverage_rate"),
      supabase.from("v_dropout").select("started, completed"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("inventories")
        .select("*", { count: "exact", head: true })
        .lte("stock_quantity", 50),
      supabase
        .from("audit_log")
        .select("id, action, at, actor_id")
        .order("at", { ascending: false })
        .limit(8),
    ]);

  const rates = (cov ?? []).map((r) => r.coverage_rate).filter((r): r is number => r != null);
  const avgCoverage = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

  const started = (drop ?? []).reduce((a, r) => a + (r.started ?? 0), 0);
  const completed = (drop ?? []).reduce((a, r) => a + (r.completed ?? 0), 0);
  const dropoutRate = started ? 1 - completed / started : null;

  const usersCount = usersRes.count ?? 0;
  const lowStockCount = lowStockRes.count ?? 0;

  const actorIds = [...new Set((audit ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const nameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">ড্যাশবোর্ড</h1>
        <p className="text-sm text-[var(--color-muted)]">টিকাদান কর্মসূচির সারসংক্ষেপ</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="গড় টিকা কভারেজ"
          value={pctBn(avgCoverage)}
          tone={avgCoverage != null && avgCoverage >= 0.8 ? "success" : "warning"}
          hint="সময়মতো প্রাপ্ত ডোজের গড় হার"
        />
        <StatCard
          label="ড্রপআউট হার"
          value={pctBn(dropoutRate)}
          tone={dropoutRate != null && dropoutRate > 0.1 ? "danger" : "success"}
          hint="প্রথম ডোজ নিয়েছে কিন্তু সম্পূর্ণ করেনি"
        />
        <StatCard
          label="স্বল্প মজুদ ব্যাচ"
          value={toBn(lowStockCount)}
          tone={lowStockCount > 0 ? "warning" : "success"}
          hint="৫০ ইউনিট বা তার কম"
        />
        <StatCard label="মোট ব্যবহারকারী" value={toBn(usersCount)} tone="primary" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">সাম্প্রতিক কার্যক্রম</h2>
        {audit && audit.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">কার্যক্রম</th>
                  <th className="px-4 py-2 font-medium">ব্যবহারকারী</th>
                  <th className="px-4 py-2 font-medium">সময়</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2">
                      <StatusBadge tone="muted">{auditLabel(row.action)}</StatusBadge>
                    </td>
                    <td className="px-4 py-2">{nameById.get(row.actor_id ?? "") ?? "—"}</td>
                    <td className="px-4 py-2 text-[var(--color-muted)]">{dateBn(row.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">কোনো কার্যক্রম নেই।</p>
        )}
      </section>
    </div>
  );
}
