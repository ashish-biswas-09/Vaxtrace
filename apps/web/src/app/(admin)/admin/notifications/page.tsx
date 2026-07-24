import { requireRole } from "@/lib/auth";
import { toBn, dateBn } from "@/lib/format";
import { StatCard, StatusBadge } from "../_components/ui";

export const dynamic = "force-dynamic";

const STATUS_BN: Record<string, { label: string; tone: "muted" | "success" | "warning" | "danger" }> = {
  queued: { label: "সারিবদ্ধ", tone: "muted" },
  sent: { label: "পাঠানো", tone: "success" },
  failed: { label: "ব্যর্থ", tone: "warning" },
  dead: { label: "বাতিল", tone: "danger" },
};

const CHANNEL_BN: Record<string, string> = { sms: "SMS", email: "ইমেইল" };

export default async function NotificationsPage() {
  const supabase = await requireRole("admin");

  const [{ data: all }, { data: log }] = await Promise.all([
    supabase.from("notifications").select("status"),
    supabase
      .from("notifications")
      .select("id, recipient_id, channel, status, due_date, scheduled_for, sent_at")
      .order("scheduled_for", { ascending: false })
      .limit(100),
  ]);

  const count = (s: string) => (all ?? []).filter((n) => n.status === s).length;

  const recipientIds = [...new Set((log ?? []).map((n) => n.recipient_id))];
  const { data: people } = recipientIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", recipientIds)
    : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">বিজ্ঞপ্তি ও জব</h1>
        <p className="text-sm text-[var(--color-muted)]">রিমাইন্ডার ডেলিভারি লগ ও সারির অবস্থা</p>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="সারিবদ্ধ" value={toBn(count("queued"))} tone="muted" />
        <StatCard label="পাঠানো" value={toBn(count("sent"))} tone="success" />
        <StatCard label="ব্যর্থ" value={toBn(count("failed"))} tone="warning" />
        <StatCard label="বাতিল" value={toBn(count("dead"))} tone="danger" />
      </section>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">প্রাপক</th>
              <th className="px-4 py-3 font-medium">চ্যানেল</th>
              <th className="px-4 py-3 font-medium">নির্ধারিত সময়</th>
              <th className="px-4 py-3 font-medium">অবস্থা</th>
              <th className="px-4 py-3 font-medium">পাঠানো</th>
            </tr>
          </thead>
          <tbody>
            {(log ?? []).map((n) => {
              const st = STATUS_BN[n.status] ?? { label: n.status, tone: "muted" as const };
              return (
                <tr key={n.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">{nameById.get(n.recipient_id) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone="muted">{CHANNEL_BN[n.channel] ?? n.channel}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{dateBn(n.scheduled_for)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {n.sent_at ? dateBn(n.sent_at) : "—"}
                  </td>
                </tr>
              );
            })}
            {(log ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  কোনো বিজ্ঞপ্তি নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
