import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { pctBn, toBn, dateBn, dateTimeBn, todayIso } from "@/lib/format";
import { StatCard, StatusBadge } from "./_components/ui";
import { CoverageBars, type CoverageRow } from "./_components/Chart";
import { batchStatus } from "./inventory/status";
import { auditLabel } from "./_audit";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await requireRole("admin");

  const today = todayIso();

  const [
    { data: cov },
    { data: drop },
    childrenRes,
    { data: stock },
    { data: audit },
    { data: aefi },
    dueRes,
    missedRes,
    { data: defaulters },
    zeroDoseRes,
    { data: coldChain },
  ] = await Promise.all([
      supabase
        .from("v_coverage")
        .select("code, name_bn, coverage_rate, done_count, due_count")
        .order("code"),
      supabase.from("v_dropout").select("started, completed"),
      // Registered children, not user accounts: the programme is measured in children reached.
      supabase.from("children").select("*", { count: "exact", head: true }),
      supabase
        .from("inventories")
        .select("id, vaccine_id, batch_number, stock_quantity, expiry_date")
        .order("expiry_date", { ascending: true }),
      supabase
        .from("audit_log")
        .select("id, action, at, actor_id")
        .order("at", { ascending: false })
        .limit(8),
      // Adverse events following immunisation. Now read as cases rather than as the free-text
      // column they used to be, so the panel can say whether anybody has looked at them —
      // which is the actual question, and the one a note on a dose record could never answer.
      supabase
        .from("v_aefi_cases")
        .select("id, code, child_id, child_name, child_code, vaccine_name_bn, onset_date, symptoms, severity, status, investigation_overdue")
        .in("status", ["reported", "under_investigation"])
        .order("onset_date", { ascending: false })
        .limit(5),
      // Coverage and dropout are lagging indicators — they describe what already went wrong.
      // Doses due and doses missed are the leading ones, and the only numbers on this screen
      // an admin can still act on today.
      supabase
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .lte("due_date", today),
      supabase.from("schedules").select("*", { count: "exact", head: true }).eq("status", "missed"),
      // The three signals the new screens own. Each is a count of things that need a person to
      // do something today, which is the only kind of number this row carries.
      supabase.from("v_defaulters").select("child_id, has_open_task"),
      supabase.from("v_zero_dose").select("child_id", { count: "exact", head: true }),
      supabase.from("v_cold_chain").select("device_id, has_excursion, is_silent, is_active"),
    ]);

  const rates = (cov ?? []).map((r) => r.coverage_rate).filter((r): r is number => r != null);
  const avgCoverage = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

  const started = (drop ?? []).reduce((a, r) => a + (r.started ?? 0), 0);
  const completed = (drop ?? []).reduce((a, r) => a + (r.completed ?? 0), 0);
  const dropoutRate = started ? 1 - completed / started : null;

  const childrenCount = childrenRes.count ?? 0;

  const { data: vaccines } = await supabase.from("vaccines").select("id, name_bn");
  const vaccineById = new Map((vaccines ?? []).map((v) => [v.id, v.name_bn]));

  // The child's name and code used to need a second query here. v_aefi_cases carries both, so
  // the lookup is gone rather than kept "in case" — a round-trip that returns data the first
  // query already had is the kind of thing that survives forever once written.

  // Actionable alerts: the actual batches needing attention (low/expiring), not just a count.
  const alerts = (stock ?? [])
    .map((b) => ({ ...b, status: batchStatus(b.stock_quantity, b.expiry_date) }))
    .filter((b) => b.status.tone !== "success")
    .slice(0, 5);
  const lowStockCount = (stock ?? []).filter(
    (b) => batchStatus(b.stock_quantity, b.expiry_date).tone !== "success",
  ).length;

  const actorIds = [...new Set((audit ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const nameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const dueCount = dueRes.count ?? 0;
  const missedCount = missedRes.count ?? 0;

  // A defaulter with no open tracing task is a child nobody has been asked to visit. It is the
  // gap between knowing and doing, and it is the number that says whether the tracing board is
  // being used or merely exists.
  const untracked = (defaulters ?? []).filter((d) => !d.has_open_task).length;
  const zeroDoseCount = zeroDoseRes.count ?? 0;
  const coldChainAlerts = (coldChain ?? []).filter(
    (d) => d.is_active && (d.has_excursion || d.is_silent),
  ).length;

  // First run: an admin looking at a dashboard of dashes needs to be told what to do, not
  // left to guess whether the system is broken or simply empty.
  if (childrenCount === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold">ড্যাশবোর্ড</h1>
        </header>
        <section className="rounded-xl border border-[var(--color-border)] p-8 text-center">
          <h2 className="text-lg font-medium">এখনো কোনো শিশু নিবন্ধিত নেই</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
            প্রথম শিশু নিবন্ধন করলেই তার ১০-সংখ্যার আইডি ও সম্পূর্ণ টিকার সূচি স্বয়ংক্রিয়ভাবে
            তৈরি হবে, এবং এই ড্যাশবোর্ডে কভারেজ ও ড্রপআউট দেখা যাবে।
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/admin/children/new"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
            >
              + শিশু নিবন্ধন করুন
            </Link>
            <Link
              href="/admin/catalog"
              className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
            >
              টিকা তালিকা দেখুন
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">ড্যাশবোর্ড</h1>
          <p className="text-sm text-[var(--color-muted)]">টিকাদান কর্মসূচির সারসংক্ষেপ</p>
        </div>
        {/* Every number below is "now" with nothing saying so. A dashboard that gets
            screenshotted into a report needs to carry its own timestamp. */}
        <p className="text-xs text-[var(--color-muted)]">হালনাগাদ: {dateTimeBn(new Date().toISOString())}</p>
      </header>

      {/* Act-now first, then explain. Every card here is a count of things that need a person
          to do something today, and every one of them is a link into the list behind it — a
          KPI whose next question ("show me which ones") has no answer is a dead end. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="দেয় ডোজ"
          value={toBn(dueCount)}
          tone={dueCount > 0 ? "warning" : "success"}
          hint="আজ বা তার আগে নির্ধারিত, এখনো দেওয়া হয়নি"
          href="/admin/children"
        />
        <StatCard
          label="ফলো-আপ বরাদ্দ হয়নি"
          value={toBn(untracked)}
          tone={untracked > 0 ? "danger" : "success"}
          hint="টিকা বাকি, অথচ কেউ পরিদর্শনের দায়িত্ব নেয়নি"
          href="/admin/tracing"
        />
        <StatCard
          label="শূন্য-ডোজ শিশু"
          value={toBn(zeroDoseCount)}
          tone={zeroDoseCount > 0 ? "danger" : "success"}
          hint="১২ মাসের কম বয়সী, একটিও ডোজ পায়নি"
          href="/admin/zero-dose"
        />
        <StatCard
          label="বাদ পড়া ডোজ"
          value={toBn(missedCount)}
          tone={missedCount > 0 ? "danger" : "success"}
          hint="১৪ দিনের বেশি বিলম্বিত"
          href="/admin/children"
        />
        <StatCard
          label="মনোযোগ প্রয়োজন (মজুদ)"
          value={toBn(lowStockCount)}
          tone={lowStockCount > 0 ? "warning" : "success"}
          hint="স্বল্প, মেয়াদোত্তীর্ণ বা মেয়াদ-ঘনিয়ে-আসা ব্যাচ"
          href="/admin/inventory"
        />
        <StatCard
          label="কোল্ড চেইন সতর্কতা"
          value={toBn(coldChainAlerts)}
          tone={coldChainAlerts > 0 ? "danger" : "success"}
          hint="সীমা ভেঙেছে বা ২৪ ঘণ্টা ধরে নীরব"
          href="/admin/cold-chain"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="গড় টিকা কভারেজ"
          value={pctBn(avgCoverage)}
          tone={avgCoverage != null && avgCoverage >= 0.8 ? "success" : "warning"}
          hint="দেয় ডোজের মধ্যে সম্পন্ন"
          href="/admin/reports"
        />
        <StatCard
          label="ড্রপআউট হার"
          value={pctBn(dropoutRate)}
          tone={dropoutRate != null && dropoutRate > 0.1 ? "danger" : "success"}
          hint="প্রথম ডোজ নিয়েছে কিন্তু সম্পূর্ণ করেনি"
          href="/admin/reports"
        />
        <StatCard
          label="নিবন্ধিত শিশু"
          value={toBn(childrenCount)}
          tone="primary"
          hint="প্রত্যেকের একটি অপরিবর্তনীয় ১০-সংখ্যার আইডি"
          href="/admin/children"
        />
      </section>

      {(aefi ?? []).length > 0 && (
        <section className="rounded-xl border border-[var(--color-danger)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium text-[var(--color-danger)]">
              খোলা AEFI কেস
            </h2>
            <Link href="/admin/aefi" className="text-xs text-[var(--color-primary)]">
              সব কেস →
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {(aefi ?? []).map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <Link
                    href={`/admin/children/${r.child_id}`}
                    className="font-medium hover:underline"
                  >
                    {r.child_name ?? "—"}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">
                    {r.child_code ? toBn(r.child_code) : ""}
                  </span>
                  <div className="text-xs text-[var(--color-danger)]">{r.symptoms}</div>
                </div>
                <span className="shrink-0 text-right text-xs text-[var(--color-muted)]">
                  {r.vaccine_name_bn ?? ""} · {dateBn(r.onset_date)}
                  {/* An open serious case older than 48 hours is the one line on this
                      dashboard that means somebody has to be telephoned. */}
                  {r.investigation_overdue && (
                    <StatusBadge tone="danger">তদন্তে বিলম্ব</StatusBadge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-[var(--color-border)] p-5">
          <h2 className="mb-4 text-lg font-medium">টিকাভিত্তিক কভারেজ</h2>
          <CoverageBars rows={(cov ?? []) as CoverageRow[]} />
        </section>

        <section className="rounded-xl border border-[var(--color-border)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">মজুদ সতর্কতা</h2>
            <Link href="/admin/inventory" className="text-xs text-[var(--color-primary)]">
              সব দেখুন →
            </Link>
          </div>
          {alerts.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {alerts.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{vaccineById.get(b.vaccine_id) ?? "—"}</div>
                    <div className="font-mono text-xs text-[var(--color-muted)]">
                      {b.batch_number} · {toBn(b.stock_quantity)} · {dateBn(b.expiry_date)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={b.status.tone}>{b.status.label}</StatusBadge>
                    <Link
                      href={`/admin/inventory/${b.id}`}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      পুনঃমজুদ
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">সব মজুদ স্বাভাবিক।</p>
          )}
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">সাম্প্রতিক কার্যক্রম</h2>
          <Link href="/admin/audit" className="text-xs text-[var(--color-primary)]">
            সম্পূর্ণ অডিট লগ →
          </Link>
        </div>
        {audit && audit.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">কার্যক্রম</th>
                  <th scope="col" className="px-4 py-2 font-medium">ব্যবহারকারী</th>
                  <th scope="col" className="px-4 py-2 font-medium">সময়</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2">
                      <StatusBadge tone="muted">{auditLabel(row.action)}</StatusBadge>
                    </td>
                    <td className="px-4 py-2">
                      {row.actor_id ? (nameById.get(row.actor_id) ?? "—") : "সিস্টেম"}
                    </td>
                    {/* dateBn alone rendered every entry from today as the same string, so
                        the feed read as unordered. The time is the whole point of a feed. */}
                    <td className="px-4 py-2 text-[var(--color-muted)]">{dateTimeBn(row.at)}</td>
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
