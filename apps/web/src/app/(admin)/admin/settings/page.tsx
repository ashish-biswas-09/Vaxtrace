import { requireRole } from "@/lib/auth";
import { StatusBadge } from "../_components/ui";

export const dynamic = "force-dynamic";

// ponytail: display-only. No app_settings table and no live-effect wiring, because nothing
// consumes these yet (the reminder dispatcher/cron isn't built — only mv_daily_doses refresh
// exists). Faking toggles that change nothing is worse than showing the config surface
// honestly. When the dispatcher ships, back these with an app_settings key/value table and
// make the reminder rows editable.

function Row({ label, desc, value }: { label: string; desc: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] px-4 py-3 first:border-t-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--color-muted)]">{desc}</p>
      </div>
      <div className="shrink-0">{value}</div>
    </div>
  );
}

function On() {
  return <StatusBadge tone="success">সক্রিয়</StatusBadge>;
}
function Off() {
  return <StatusBadge tone="muted">নিষ্ক্রিয়</StatusBadge>;
}
function Val({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-[var(--color-muted)]">{children}</span>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)]">
      <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">সিস্টেম সেটিংস</h1>
        <p className="text-sm text-[var(--color-muted)]">রিমাইন্ডার, সূচি নিয়ম, কেন্দ্র ও নিরাপত্তা</p>
      </header>

      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-border)]/20 px-4 py-2 text-xs text-[var(--color-muted)]">
        এই সেটিংস প্রদর্শনের জন্য — রিমাইন্ডার ডিসপ্যাচার চালু হলে সম্পাদনাযোগ্য হবে।
      </p>

      <Group title="রিমাইন্ডার ও বিজ্ঞপ্তি">
        <Row label="রিমাইন্ডার লিড টাইম" desc="দেয় তারিখের কত আগে জানানো হবে" value={<Val>৩ দিন</Val>} />
        <Row label="দৈনিক রিমাইন্ডার রান" desc="cron জব কখন রিমাইন্ডার পাঠায়" value={<Val>২০:০০</Val>} />
        <Row label="SMS চ্যানেল" desc="SMS গেটওয়ে দিয়ে পাঠান" value={<On />} />
        <Row label="ইমেইল চ্যানেল" desc="SMTP (Nodemailer) দিয়ে" value={<On />} />
        <Row label="নীরব সময়" desc="রাত ৯টা – সকাল ৭টা বন্ধ" value={<On />} />
      </Group>

      <Group title="সূচি নিয়ম">
        <Row label="NIS সূচি সংস্করণ" desc="স্বয়ংক্রিয় সূচির নিয়ম ডিবি" value={<Val>v3 (বর্তমান)</Val>} />
        <Row label="নিবন্ধনে স্বয়ংক্রিয় তৈরি" desc="জন্মতারিখ থেকে পূর্ণ সূচি" value={<On />} />
        <Row label="ডুপ্লিকেট সনাক্তকরণ" desc="অভিভাবক যোগাযোগ + জন্মতারিখে ব্লক" value={<On />} />
      </Group>

      <Group title="নিরাপত্তা ও অ্যাক্সেস">
        <Row
          label="স্টাফদের জন্য দ্বি-স্তর OTP"
          desc="কর্মী ও অ্যাডমিন লগইনে OTP আবশ্যক (প্রোডাকশনে বাধ্যতামূলক)"
          value={<Off />}
        />
        <Row label="সেশন টাইমআউট" desc="নিষ্ক্রিয়তার পর স্বয়ংক্রিয় সাইন-আউট" value={<Val>৩০ মিনিট</Val>} />
      </Group>
    </div>
  );
}
