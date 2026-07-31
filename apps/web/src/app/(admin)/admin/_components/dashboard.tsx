import Link from "next/link";
import { dateBn, toBn } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  getAlerts,
  getCoverage,
  getDefaulterQueue,
  getDoseTrend,
  getFailedQueue,
  getKpis,
  getSessionPlan,
  getStockQueue,
  windowDates,
  type Window,
} from "../_queries";
import { Callout } from "./Callout";
import { CoverageBars, TrendArea, type CoverageRow } from "./Chart";
import { QueueCard, type QueueRow } from "./QueueCard";
import { StatCard, StatusBadge } from "@/components/ui/kit";

// One async component per dashboard zone, each awaited inside its own <Suspense> in the page.
// Severity descends: what needs a decision today, then the numbers that justify one, then the
// trend behind them, then the record of what already happened.

// ── 1 · Alerts ──────────────────────────────────────────────────────────────────

export async function AlertRail() {
  const a = await getAlerts();
  const nothing =
    !a.aefiOverdue.length && !a.expiredBatches && !a.coldChain && !a.untraced;
  if (nothing) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="সতর্কতা">
      {a.aefiOverdue.length > 0 && (
        <Callout
          tone="danger"
          title={`তদন্তে বিলম্বিত AEFI — ${toBn(a.aefiOverdue.length)}টি`}
          href="/admin/aefi"
          hrefLabel="কেস দেখুন"
        >
          <ul className="flex flex-col gap-1">
            {a.aefiOverdue.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={`/admin/children/${r.child_id}`}
                  className="font-medium text-[var(--text-primary)] hover:underline"
                >
                  {r.child_name ?? "—"}
                </Link>
                {r.child_code && (
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {toBn(r.child_code)}
                  </span>
                )}
                <span className="text-[var(--danger)]">{r.symptoms}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {r.vaccine_name_bn ?? ""} · {dateBn(r.onset_date)}
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {a.coldChain > 0 && (
        <Callout
          tone="danger"
          title={`কোল্ড চেইন সতর্কতা — ${toBn(a.coldChain)}টি ডিভাইস`}
          href="/admin/cold-chain"
          hrefLabel="ডিভাইস দেখুন"
        >
          সীমা ভেঙেছে বা ২৪ ঘণ্টা ধরে নীরব — এই ফ্রিজের টিকা ব্যবহারের আগে যাচাই করুন।
        </Callout>
      )}

      {a.expiredBatches > 0 && (
        <Callout
          tone="danger"
          title={`মেয়াদোত্তীর্ণ ব্যাচ — ${toBn(a.expiredBatches)}টি`}
          href="/admin/inventory"
          hrefLabel="মজুদ দেখুন"
        >
          এগুলো ব্যবহার করা যাবে না। তালিকা থেকে সরিয়ে ফেলুন বা পুনঃমজুদ করুন।
        </Callout>
      )}

      {a.untraced > 0 && (
        <Callout
          tone="warning"
          title={`ফলো-আপ বরাদ্দ হয়নি — ${toBn(a.untraced)}টি শিশু`}
          href="/admin/tracing"
          hrefLabel="বোর্ড দেখুন"
        >
          টিকা বাকি, অথচ কেউ পরিদর্শনের দায়িত্ব নেয়নি।
        </Callout>
      )}
    </section>
  );
}

// ── 2 · KPIs ────────────────────────────────────────────────────────────────────

export async function KpiRow({ w }: { w: Window }) {
  const k = await getKpis(w);
  const period = `গত ${toBn(w.days)} দিনে`;
  const vsPrev = "আগের সমান সময়ের তুলনায়";

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="প্রদত্ত ডোজ"
        value={toBn(k.administered.value)}
        tone="success"
        hint={period}
        delta={{ ...k.administered.delta, goodDirection: "up", period: vsPrev }}
        sparkline={k.administered.spark}
      />
      <StatCard
        label="বাদ পড়া ডোজ"
        value={toBn(k.missed.value)}
        tone={k.missed.value > 0 ? "danger" : "success"}
        hint={`${period} বাদ পড়েছে`}
        delta={{ ...k.missed.delta, goodDirection: "down", period: vsPrev }}
        href="/admin/tracing"
      />
      <StatCard
        label="দেয় ডোজ (এখন)"
        value={toBn(k.dueNow.value)}
        tone={k.dueNow.value > 0 ? "warning" : "success"}
        hint="আজ বা তার আগে নির্ধারিত, এখনো দেওয়া হয়নি"
        sparkline={k.dueNow.spark}
        href="/admin/children"
      />
      <StatCard
        label="নিবন্ধিত শিশু"
        value={toBn(k.children.total)}
        tone="primary"
        hint="প্রত্যেকের একটি অপরিবর্তনীয় ১০-সংখ্যার আইডি"
        delta={{ ...k.children.delta, goodDirection: "up", period: `নতুন, ${period}` }}
        sparkline={k.children.spark}
        href="/admin/children"
      />
    </section>
  );
}

// ── 3 · Trends ──────────────────────────────────────────────────────────────────

export async function Trends({ w }: { w: Window }) {
  const [coverage, trend] = await Promise.all([getCoverage(), getDoseTrend(w)]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader
          title="টিকাভিত্তিক কভারেজ"
          action={
            <Link href="/admin/coverage" className="text-xs text-[var(--accent)] hover:underline">
              এলাকাভিত্তিক কভারেজ →
            </Link>
          }
        />
        <CoverageBars rows={coverage as CoverageRow[]} />
      </Card>

      <Card>
        <CardHeader title={`দৈনিক প্রদত্ত ডোজ — গত ${toBn(w.days)} দিন`} />
        <TrendArea points={trend} labels={windowDates(w)} caption="দৈনিক প্রদত্ত ডোজ" />
      </Card>
    </div>
  );
}

// ── 4 · Act-now queues ──────────────────────────────────────────────────────────

export async function Queues() {
  const [stock, defaulters, failed] = await Promise.all([
    getStockQueue(),
    getDefaulterQueue(),
    getFailedQueue(),
  ]);

  const stockRows: QueueRow[] = stock.map((b) => ({
    key: b.id,
    title: b.vaccine,
    sub: (
      <span className="font-mono">
        {b.batch} · {toBn(b.qty)} · {dateBn(b.expiry)}
      </span>
    ),
    badge: <StatusBadge tone={b.tone}>{b.label}</StatusBadge>,
    action: { href: `/admin/inventory/${b.id}`, label: "পুনঃমজুদ" },
  }));

  const defaulterRows: QueueRow[] = defaulters.map((c) => ({
    key: c.child_id ?? "",
    title: c.full_name ?? "—",
    sub: (
      <>
        <span className="font-mono">{c.child_code ? toBn(c.child_code) : ""}</span>
        {c.guardian_phone ? ` · ${c.guardian_phone}` : ""} · {toBn(c.days_overdue ?? 0)} দিন বিলম্ব
      </>
    ),
    badge: <StatusBadge tone="danger">{toBn(c.doses_missed ?? 0)} ডোজ</StatusBadge>,
    action: { href: `/admin/children/${c.child_id}`, label: "রেকর্ড" },
  }));

  const failedRows: QueueRow[] = failed.map((n) => ({
    key: n.id,
    title: n.name,
    sub: n.error ?? n.channel,
    badge: (
      <StatusBadge tone={n.status === "dead" ? "danger" : "warning"}>
        {n.status === "dead" ? "বাতিল" : "ব্যর্থ"}
      </StatusBadge>
    ),
  }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <QueueCard
        title="মজুদ সতর্কতা"
        rows={stockRows}
        emptyLabel="সব মজুদ স্বাভাবিক।"
        allHref="/admin/inventory"
      />
      <QueueCard
        title="ফলো-আপ বরাদ্দ হয়নি"
        rows={defaulterRows}
        emptyLabel="প্রতিটি বাদ পড়া শিশুর জন্য কাজ বরাদ্দ আছে।"
        allHref="/admin/tracing"
      />
      <QueueCard
        title="বিজ্ঞপ্তি ব্যর্থতা"
        rows={failedRows}
        emptyLabel="সব বিজ্ঞপ্তি পাঠানো হয়েছে।"
        allHref="/admin/notifications"
      />
    </div>
  );
}

// ── 5 · Session plan ────────────────────────────────────────────────────────────
//
// Replaces the raw audit feed that used to sit here. That feed listed whatever the triggers
// had written last — usually eight identical system inserts — which is a log, not a decision
// aid. This is the fortnight's work: what already ran and what it produced, and what is
// coming that still needs a team and stock behind it.

const SESSION_TYPE_BN: Record<string, string> = {
  fixed: "কেন্দ্রে",
  outreach: "আউটরিচ",
  campaign: "ক্যাম্পেইন",
};

export async function SessionPlan() {
  const rows = await getSessionPlan();
  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader
        title="সেশন পরিকল্পনা"
        action={
          <Link href="/admin/sessions" className="text-sm text-[var(--color-primary)]">
            সব দেখুন →
          </Link>
        }
      />
      <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
            <span className="min-w-[5.5rem] text-[var(--text-secondary)]">{dateBn(r.date)}</span>
            <StatusBadge
              tone={
                r.status === "cancelled" ? "danger" : r.status === "held" ? "muted" : "primary"
              }
            >
              {SESSION_TYPE_BN[r.type] ?? r.type}
            </StatusBadge>
            <span className="truncate text-[var(--text-primary)]">{r.facility}</span>
            {r.isToday && <StatusBadge tone="primary">আজ</StatusBadge>}
            <span className="ml-auto text-xs text-[var(--text-muted)]">
              {r.status === "held"
                ? `${toBn(r.doses)} ডোজ · ${toBn(r.children)} শিশু`
                : r.target !== null
                  ? `লক্ষ্য ${toBn(r.target)} শিশু`
                  : "—"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Skeletons ───────────────────────────────────────────────────────────────────

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-[var(--r-lg)]" />
      ))}
    </div>
  );
}

export function BlockSkeleton({ className = "h-64" }: { className?: string }) {
  return <Skeleton className={`${className} rounded-[var(--r-lg)]`} />;
}
