import Link from "next/link";
import { mfaGate, requireAppRole } from "@/lib/auth";
import { dateBn, dateTimeBn, pctBn, toBn, todayIso } from "@/lib/format";
import { PageHeader, StatCard, StatusBadge } from "../_components/ui";
import { PrintButton } from "../_components/PrintButton";
import { MovementForm } from "./_components/MovementForm";
import { LedgerTable, type LedgerRow } from "./_components/LedgerTable";

export const dynamic = "force-dynamic";

// The stock ledger (report decision D5, BUG-04).
//
// `inventories.stock_quantity` used to be a number somebody typed, and two concurrent issues
// could each subtract from the value they had read — the classic lost update. It is now a cache
// of the sum of these rows, written only by a trigger as a delta, and reconciled nightly. So
// this screen is not "an audit trail of stock": it IS the stock. The balance on the inventory
// screen is derived from what is listed here.
export default async function StockPage() {
  const { supabase, claims } = await requireAppRole("store_keeper");
  await mfaGate(supabase, claims);

  const today = todayIso();

  const [{ data: summary }, { data: ledger }, { data: batches }, { data: health }] =
    await Promise.all([
      supabase
        .from("v_stock_summary")
        .select("vaccine_id, vaccine_code, vaccine_name_bn, facility_id, facility_name_bn, on_hand, expired_batches, expiring_batches, next_expiry, wasted_90d, administered_90d, wastage_rate_90d")
        .order("vaccine_code"),
      supabase
        .from("v_stock_ledger")
        .select("id, occurred_at, txn_type, quantity, reason, note, batch_number, expiry_date, batch_balance, vaccine_code, vaccine_name_bn, facility_name_bn, counterparty_name_bn, performed_by_name")
        .order("occurred_at", { ascending: false })
        .limit(400),
      supabase
        .from("inventories")
        .select("id, batch_number, stock_quantity, expiry_date, vaccine_id, facility_id")
        .order("expiry_date"),
      supabase.from("v_job_health").select("job_name, is_stale, last_error").eq("job_name", "reconcile-stock").maybeSingle(),
    ]);

  const { data: vaccines } = await supabase
    .from("vaccines")
    .select("id, code, name_bn")
    .eq("is_active", true)
    .order("code");
  const vaccineById = new Map((vaccines ?? []).map((v) => [v.id, v]));

  const rows: LedgerRow[] = (ledger ?? []).map((t) => ({
    id: t.id ?? "",
    at: t.occurred_at ?? "",
    type: t.txn_type ?? "adjustment",
    quantity: Number(t.quantity ?? 0),
    reason: t.reason ?? null,
    note: t.note ?? null,
    batch: t.batch_number ?? "—",
    expiry: t.expiry_date,
    balance: Number(t.batch_balance ?? 0),
    vaccine: `${t.vaccine_name_bn ?? ""} (${t.vaccine_code ?? ""})`,
    facility: t.facility_name_bn ?? "—",
    counterparty: t.counterparty_name_bn ?? null,
    by: t.performed_by_name ?? "—",
  }));

  const onHand = (summary ?? []).reduce((n, s) => n + Number(s.on_hand ?? 0), 0);
  const wasted = (summary ?? []).reduce((n, s) => n + Number(s.wasted_90d ?? 0), 0);
  const given = (summary ?? []).reduce((n, s) => n + Number(s.administered_90d ?? 0), 0);
  const wastageRate = wasted + given > 0 ? wasted / (wasted + given) : null;
  const expiring = (summary ?? []).reduce((n, s) => n + Number(s.expiring_batches ?? 0), 0);
  const expired = (summary ?? []).reduce((n, s) => n + Number(s.expired_batches ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="স্টক লেজার"
        description="প্রতিটি ভায়ালের প্রতিটি নড়াচড়া — গ্রহণ, প্রয়োগ, অপচয়, স্থানান্তর, সমন্বয় — একটি করে সারি। মজুদের সংখ্যা এই সারিগুলোর যোগফল; কেউ সরাসরি লেখে না, তাই দুইজন একসঙ্গে কাজ করলেও হিসাব হারায় না।"
        actions={<PrintButton label="লেজার ছাপুন" />}
      />

      {health?.is_stale && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-danger)] px-4 py-3 text-sm text-[var(--color-danger)] print:hidden"
        >
          রাতের মিলকরণ কাজটি (<span className="font-mono">reconcile-stock</span>) সময়মতো চলেনি,
          তাই মজুদের সংখ্যা লেজারের সঙ্গে মিলছে কি না তা এখন যাচাই করা যাচ্ছে না।{" "}
          <Link href="/admin/settings" className="underline">
            কাজের অবস্থা দেখুন
          </Link>
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <StatCard label="মোট মজুদ" value={toBn(onHand)} hint="সব ব্যাচ, সব কেন্দ্র" />
        <StatCard
          label="অপচয়ের হার (৯০ দিন)"
          value={pctBn(wastageRate)}
          tone={wastageRate == null ? "muted" : wastageRate > 0.25 ? "danger" : wastageRate > 0.15 ? "warning" : "success"}
          hint={
            wastageRate == null
              ? "৯০ দিনে কোনো ডোজ প্রয়োগ বা অপচয় হয়নি"
              : `${toBn(wasted)} অপচয় / ${toBn(wasted + given)} ব্যবহৃত`
          }
        />
        <StatCard
          label="৩০ দিনে মেয়াদ শেষ"
          value={toBn(expiring)}
          tone={expiring > 0 ? "warning" : "success"}
          href="/admin/inventory"
          hint="আগে এগুলো ব্যবহার করুন (FEFO)"
        />
        <StatCard
          label="মেয়াদোত্তীর্ণ ব্যাচ"
          value={toBn(expired)}
          tone={expired > 0 ? "danger" : "success"}
          hint={expired > 0 ? "অপচয় হিসেবে লিখে মজুদ থেকে সরান" : "কোনো মেয়াদোত্তীর্ণ মজুদ নেই"}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">টিকাভিত্তিক অবস্থা</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">টিকা</th>
                <th scope="col" className="px-4 py-3 font-medium">কেন্দ্র</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">মজুদ</th>
                <th scope="col" className="px-4 py-3 font-medium">পরবর্তী মেয়াদ</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">প্রয়োগ (৯০ দিন)</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">অপচয় (৯০ দিন)</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">অপচয়ের হার</th>
              </tr>
            </thead>
            <tbody>
              {(summary ?? []).map((s) => (
                <tr
                  key={`${s.vaccine_id}-${s.facility_id ?? "none"}`}
                  className="border-t border-[var(--color-border)]"
                >
                  <td className="px-4 py-2.5">
                    {s.vaccine_name_bn}
                    <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">
                      {s.vaccine_code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{s.facility_name_bn ?? "অনির্ধারিত"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{toBn(s.on_hand ?? 0)}</td>
                  <td className="px-4 py-2.5">
                    {s.next_expiry ? (
                      <StatusBadge
                        tone={
                          s.next_expiry < today
                            ? "danger"
                            : s.next_expiry < addDays(today, 30)
                              ? "warning"
                              : "muted"
                        }
                      >
                        {dateBn(s.next_expiry)}
                      </StatusBadge>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {toBn(s.administered_90d ?? 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{toBn(s.wasted_90d ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {/* UX-07 again: no doses moved at all is `—`, not ০%. */}
                    <StatusBadge
                      tone={
                        s.wastage_rate_90d == null
                          ? "muted"
                          : s.wastage_rate_90d > 0.25
                            ? "danger"
                            : s.wastage_rate_90d > 0.15
                              ? "warning"
                              : "success"
                      }
                    >
                      {pctBn(s.wastage_rate_90d)}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {(summary ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    কোনো ব্যাচ নেই। <Link href="/admin/inventory/new" className="underline">ব্যাচ যোগ করুন</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] p-5 print:hidden">
        <h2 className="mb-1 text-lg font-medium">লেনদেন লিখুন</h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          প্রয়োগকৃত ডোজ এবং কেন্দ্রের মধ্যে স্থানান্তর নিজে থেকেই লেজারে ওঠে — এখানে শুধু গ্রহণ,
          অপচয় ও শারীরিক গণনার সমন্বয় লেখা হয়।
        </p>
        <MovementForm
          batches={(batches ?? []).map((b) => ({
            id: b.id,
            label: `${vaccineById.get(b.vaccine_id)?.name_bn ?? ""} · ${b.batch_number} · মজুদ ${toBn(b.stock_quantity)} · মেয়াদ ${dateBn(b.expiry_date)}`,
            expiry: b.expiry_date,
            quantity: b.stock_quantity,
            vaccine_id: b.vaccine_id,
          }))}
          today={today}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          লেনদেনের ইতিহাস
          <span className="ml-2 text-sm font-normal text-[var(--color-muted)]">
            সর্বশেষ {toBn(rows.length)} টি
          </span>
        </h2>
        <p className="mb-3 text-sm text-[var(--color-muted)]">
          লেজার থেকে কিছু মোছা যায় না। ভুল হলে বিপরীত সমন্বয় লিখতে হয়, যাতে ভুলটির ইতিহাসও থেকে
          যায়।
        </p>
        <LedgerTable rows={rows} />
      </section>

      <p className="text-xs text-[var(--color-muted)] print-only">
        ছাপানোর সময়: {dateTimeBn(new Date().toISOString())}
      </p>
    </div>
  );
}

// Local, because it is used once and `date-fns` for one addition would be a dependency for a
// line of arithmetic.
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
