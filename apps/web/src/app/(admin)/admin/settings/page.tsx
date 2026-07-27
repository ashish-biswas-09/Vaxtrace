import { requireRole } from "@/lib/auth";
import { dateTimeBn, toBn } from "@/lib/format";
import { StatusBadge } from "@/components/ui/kit";
import {
  ReminderSettingsForm,
  type ReminderSettings,
} from "./_components/ReminderSettingsForm";
export const metadata = { title: "সেটিংস" };

export const dynamic = "force-dynamic";

// This screen reports what the system *is*, not what someone hopes it is.
//
// The reminder group is now genuinely editable and genuinely load-bearing: the values are
// rows in `app_settings`, and `enqueue_reminders()` reads exactly those rows to decide which
// doses get queued, on which channels, at what hour. Everything below it is a read-only
// report of a constraint or trigger that actually exists. Only the two rows that depend on
// infrastructure nobody has bought yet are labelled পরিকল্পিত.

type Tone = "success" | "muted" | "warning";

function Row({
  label,
  desc,
  value,
}: {
  label: string;
  desc: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] px-4 py-3 first:border-t-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--color-muted)]">{desc}</p>
      </div>
      <div className="shrink-0 text-right">{value}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <StatusBadge tone={tone}>{children}</StatusBadge>;
}

function Val({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-[var(--color-muted)]">{children}</span>;
}

function Planned() {
  return <StatusBadge tone="muted">পরিকল্পিত</StatusBadge>;
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
  const supabase = await requireRole("admin");

  const [{ data: vaccines }, { data: doses }, notifRes, { data: settingRows }, { data: jobs }] =
    await Promise.all([
      supabase.from("vaccines").select("id, is_active"),
      supabase.from("vaccine_doses").select("vaccine_id"),
      supabase.from("notifications").select("*", { count: "exact", head: true }),
      supabase.from("app_settings").select("key, value"),
      // NFR-19 / REC-02. Read through ordinary RLS from a view over job_runs — no SECURITY
      // DEFINER function and no RPC surface, which is the constraint the prior audit set when
      // it removed admin_cron_jobs().
      supabase
        .from("v_job_health")
        .select(
          "job_name, last_success_at, last_duration_ms, last_result, last_error, failures_total, is_stale",
        )
        .order("job_name"),
    ]);

  const activeVaccines = (vaccines ?? []).filter((v) => v.is_active).length;
  const queuedNotifications = notifRes.count ?? 0;

  const raw = new Map((settingRows ?? []).map((r) => [r.key, r.value]));
  // Defaults mirror the migration's seeds so the form still renders if a key is missing.
  const num = (k: string, fallback: number) => Number(raw.get(k) ?? fallback);
  const bool = (k: string, fallback: boolean) => (raw.get(k) ?? fallback) === true;
  const settings: ReminderSettings = {
    reminder_lead_days: num("reminder_lead_days", 3),
    daily_run_hour: num("daily_run_hour", 20),
    quiet_hours_start: num("quiet_hours_start", 21),
    quiet_hours_end: num("quiet_hours_end", 7),
    channel_sms: bool("channel_sms", true),
    channel_email: bool("channel_email", true),
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">সিস্টেম সেটিংস</h1>
        <p className="text-sm text-[var(--color-muted)]">
          চলমান কনফিগারেশন — সরাসরি ডাটাবেস থেকে পড়া
        </p>
      </header>

      <Group title="রিমাইন্ডার ও বিজ্ঞপ্তি">
        <ReminderSettingsForm settings={settings} />
      </Group>

      <Group title="নির্ধারিত কাজের স্বাস্থ্য">
        {/* pg_cron jobs stop — on plan changes, restores and extension upgrades — and nothing
            in the product used to notice. Each job now writes a row as it runs, and this is
            where a stopped job becomes visible instead of silently ending the reminders. */}
        {(jobs ?? []).length === 0 ? (
          <Row
            label="কোনো তথ্য নেই"
            desc="কোনো নির্ধারিত কাজ এখনো চলেনি — মাইগ্রেশনের পর প্রথম রান পর্যন্ত এটি স্বাভাবিক"
            value={<Badge tone="warning">অজানা</Badge>}
          />
        ) : (
          (jobs ?? []).map((j) => (
            <Row
              key={j.job_name}
              label={j.job_name ?? "—"}
              desc={
                j.last_error
                  ? `সর্বশেষ ত্রুটি: ${j.last_error}`
                  : j.last_success_at
                    ? `সফল ${dateTimeBn(j.last_success_at)} · ${toBn(j.last_duration_ms ?? 0)} মিলিসেকেন্ড · ${j.last_result ?? ""}`
                    : "এখনো কোনো সফল রান হয়নি"
              }
              value={
                <Badge tone={j.is_stale ? "warning" : "success"}>
                  {j.is_stale ? "বন্ধ থাকতে পারে" : "চলছে"}
                </Badge>
              }
            />
          ))
        )}
      </Group>

      <Group title="সূচি নিয়ম">
        <Row
          label="নিবন্ধনে স্বয়ংক্রিয় সূচি তৈরি"
          desc="child_after_insert ট্রিগার জন্মতারিখ থেকে পূর্ণ সূচি তৈরি করে"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
        <Row
          label="সক্রিয় টিকা"
          desc="যেগুলো থেকে নতুন শিশুর সূচি তৈরি হয়"
          value={<Val>{toBn(activeVaccines)} টি</Val>}
        />
        <Row
          label="সংজ্ঞায়িত ডোজ নিয়ম"
          desc="vaccine_doses সারি — প্রতিটি ডোজের প্রস্তাবিত বয়স ও ব্যবধান"
          value={<Val>{toBn((doses ?? []).length)} টি</Val>}
        />
        <Row
          label="ডুপ্লিকেট ডোজ প্রতিরোধ"
          desc="(child, vaccine, dose) ইউনিক কনস্ট্রেইন্ট — একই ডোজ দুবার রেকর্ড হয় না"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
      </Group>

      <Group title="পরিচয় ও অডিট">
        <Row
          label="শিশু আইডি"
          desc="১০ সংখ্যা (৯ ক্রমিক + লুন চেক ডিজিট), সার্ভারে তৈরি ও অপরিবর্তনীয়"
          value={<Badge tone="success">প্রয়োগকৃত</Badge>}
        />
        <Row
          label="কর্মী ও অ্যাডমিন আইডি"
          desc="প্রতিটি ভূমিকা বরাদ্দে WKR-/ADM-/PAR- কোড, অপরিবর্তনীয়"
          value={<Badge tone="success">প্রয়োগকৃত</Badge>}
        />
        <Row
          label="অডিট ট্রিগার"
          desc="শিশু, প্রোফাইল, ডোজ রেকর্ড, মজুদ, টিকা ও ভূমিকার প্রতিটি পরিবর্তন লগ হয়"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
      </Group>

      <Group title="বিজ্ঞপ্তি">
        <Row
          label="বিজ্ঞপ্তি সারি"
          desc="notifications টেবিলে মোট সারি"
          value={<Val>{toBn(queuedNotifications)} টি</Val>}
        />
        <Row
          label="ডুপ্লিকেট প্রেরণ প্রতিরোধ"
          desc="(schedule, channel, due_date) ইউনিক — দিনে একবারের বেশি নয়"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
        <Row
          label="রিমাইন্ডার সারিবদ্ধকরণ"
          desc="enqueue_reminders() প্রতিদিন উপরের সেটিংস অনুযায়ী সারি তৈরি করে (pg_cron)"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
        <Row
          label="SMS ও ইমেইল গেটওয়ে"
          desc="dispatch-reminders ফাংশন ডিপ্লয় করা আছে; প্রোভাইডার কী সেট করা হলে পাঠানো শুরু হবে"
          value={<Planned />}
        />
      </Group>

      <Group title="নিরাপত্তা ও অ্যাক্সেস">
        <Row
          label="Row Level Security"
          desc="প্রতিটি টেবিলে ডিফল্ট-ডিনাই RLS — অনুমোদনের মূল সীমানা"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
        <Row
          label="প্রোফাইল ছবি সংরক্ষণ"
          desc="ব্যক্তিগত বাকেট, ব্যবহারকারীপ্রতি ফোল্ডার, স্বাক্ষরিত URL"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
        <Row
          label="পাসওয়ার্ড পরিবর্তনে পুনঃপ্রমাণীকরণ"
          desc="বর্তমান পাসওয়ার্ড যাচাই ছাড়া পরিবর্তন হয় না"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
        <Row
          label="এলাকাভিত্তিক প্রবেশাধিকার"
          desc="প্রতিটি নীতিতে location_path <@ auth_scopes() — কেউ নিজের বরাদ্দকৃত এলাকার বাইরের শিশুর তথ্য দেখতে পান না"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
        <Row
          label="দুই-ধাপ যাচাই (TOTP)"
          desc={
            bool("require_mfa_elevated", false)
              ? "জেলা বা উপরের স্তরের দায়িত্বে বাধ্যতামূলক — ভূমিকা বরাদ্দ, সেটিংস, জনসংখ্যার হিসাব ও অডিট লগে প্রয়োগ হয়"
              : "ব্যবস্থা প্রস্তুত, কিন্তু এখনো বাধ্যতামূলক নয় — require_mfa_elevated চালু করলে প্রয়োগ শুরু হবে"
          }
          value={
            <Badge tone={bool("require_mfa_elevated", false) ? "success" : "warning"}>
              {bool("require_mfa_elevated", false) ? "বাধ্যতামূলক" : "ঐচ্ছিক"}
            </Badge>
          }
        />
        <Row
          label="ব্যয়বহুল কাজে সীমা"
          desc="ম্যানুয়াল রিমাইন্ডার রান ও জরুরি প্রবেশাধিকারে প্রতি ঘণ্টার সীমা, ডাটাবেসে প্রয়োগকৃত"
          value={<Badge tone="success">সক্রিয়</Badge>}
        />
        <Row
          label="অভিভাবকদের জন্য ফোন OTP"
          desc="phone+OTP সাইন-ইনের জন্য একটি SMS প্রোভাইডার প্রয়োজন — কী সেট করা হলে চালু হবে"
          value={<Planned />}
        />
      </Group>
    </div>
  );
}
