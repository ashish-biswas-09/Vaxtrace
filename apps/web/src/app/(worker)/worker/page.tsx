import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ageBn, dateBn, toBn, todayIso } from "@/lib/format";
import { StatCard } from "../../(admin)/admin/_components/ui";

export const dynamic = "force-dynamic";

export default async function WorkerConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const { registered } = await searchParams;
  const supabase = await requireRole("worker");
  const today = todayIso();

  const [{ data: recent }, dueRes, overdueRes] = await Promise.all([
    supabase
      .from("children")
      .select("id, child_id, full_name, date_of_birth, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("schedules")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("due_date", today),
    supabase.from("schedules").select("*", { count: "exact", head: true }).eq("status", "missed"),
  ]);

  // Highlighted straight after a registration: the worker has to copy this ID onto the paper
  // vaccination card, so at that moment it is the most important thing on the screen.
  const justRegistered = registered
    ? (recent ?? []).find((c) => c.id === registered)
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">স্বাস্থ্যকর্মী কনসোল</h1>
          <p className="text-sm text-[var(--color-muted)]">আজকের কাজ ও সাম্প্রতিক নিবন্ধন</p>
        </div>
        <Link
          href="/worker/children/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
        >
          + শিশু নিবন্ধন
        </Link>
      </header>

      {justRegistered && (
        <section className="rounded-xl border border-[var(--color-success)] p-5">
          <p className="text-sm text-[var(--color-success)]">
            {justRegistered.full_name} নিবন্ধিত হয়েছে। টিকা কার্ডে এই আইডিটি লিখুন:
          </p>
          <p className="mt-2 font-mono text-3xl tracking-widest">
            {toBn(justRegistered.child_id)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            জন্মতারিখ অনুযায়ী সম্পূর্ণ টিকার সূচি তৈরি হয়ে গেছে।
          </p>
        </section>
      )}

      <section className="grid grid-cols-2 gap-4">
        <StatCard
          label="দেয় ডোজ"
          value={toBn(dueRes.count ?? 0)}
          tone="warning"
          hint="আজ বা তার আগে নির্ধারিত, এখনো দেওয়া হয়নি"
        />
        <StatCard
          label="বাদ পড়েছে"
          value={toBn(overdueRes.count ?? 0)}
          tone="danger"
          hint="১৪ দিনের বেশি বিলম্বিত"
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">সাম্প্রতিক নিবন্ধন</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  শিশু আইডি
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  নাম
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  বয়স
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  নিবন্ধিত
                </th>
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).map((c) => (
                <tr key={c.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-mono">{toBn(c.child_id)}</td>
                  <td className="px-4 py-3">{c.full_name}</td>
                  <td className="px-4 py-3">{ageBn(c.date_of_birth)}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{dateBn(c.created_at)}</td>
                </tr>
              ))}
              {(recent ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    এখনো কোনো শিশু নিবন্ধিত হয়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
