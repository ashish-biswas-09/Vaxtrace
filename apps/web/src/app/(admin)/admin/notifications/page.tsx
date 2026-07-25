import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { StatCard } from "../_components/ui";
import { NOTIF_STATUS } from "./status";
import { NotificationsTable, type NotifRow } from "./_components/NotificationsTable";
import { RunRemindersButton } from "./_components/RunRemindersButton";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await requireRole("admin");

  const [{ data: all }, { data: log }] = await Promise.all([
    supabase.from("notifications").select("status"),
    supabase
      .from("notifications")
      .select("id, recipient_id, channel, status, attempts, scheduled_for, sent_at, last_error")
      .order("scheduled_for", { ascending: false })
      .limit(500),
  ]);

  const count = (s: string) => (all ?? []).filter((n) => n.status === s).length;

  const recipientIds = [...new Set((log ?? []).map((n) => n.recipient_id))];
  const { data: people } = recipientIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", recipientIds)
    : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const rows: NotifRow[] = (log ?? []).map((n) => ({
    id: n.id,
    recipient_name: nameById.get(n.recipient_id) ?? "—",
    channel: n.channel,
    status: n.status,
    attempts: n.attempts,
    scheduled_for: n.scheduled_for,
    sent_at: n.sent_at,
    last_error: n.last_error,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">বিজ্ঞপ্তি ও জব</h1>
        <p className="text-sm text-[var(--color-muted)]">রিমাইন্ডার ডেলিভারি লগ ও সারির অবস্থা</p>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Object.entries(NOTIF_STATUS).map(([key, { label, tone }]) => (
          <StatCard key={key} label={label} value={toBn(count(key))} tone={tone} />
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-4 py-3">
        <p className="text-xs text-[var(--color-muted)]">
          সারি প্রতিদিন স্বয়ংক্রিয়ভাবে তৈরি হয় (pg_cron)। সেটিংস থেকে লিড টাইম ও চ্যানেল পরিবর্তন
          করা যায়। প্রকৃত পাঠানো শুরু হবে প্রোভাইডার কী সেট করার পর।
        </p>
        <RunRemindersButton />
      </section>

      <NotificationsTable rows={rows} />
    </div>
  );
}
