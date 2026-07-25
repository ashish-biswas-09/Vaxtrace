import Link from "next/link";
import { getUserRole, requireUser, roleLandingPath } from "@/lib/auth";
import { dateBn } from "@/lib/format";
import { auditLabel } from "../../(admin)/admin/_audit";
import { AvatarForm, EmailForm, PasswordForm, ProfileForm } from "./_components/AccountForms";

export const dynamic = "force-dynamic";

const ROLE_BN: Record<string, string> = {
  admin: "অ্যাডমিন",
  worker: "স্বাস্থ্যকর্মী",
  parent: "অভিভাবক",
};

const ID_LABEL_BN: Record<string, string> = {
  admin: "অ্যাডমিন আইডি",
  worker: "কর্মী আইডি",
  parent: "অভিভাবক আইডি",
};

// One account screen for all three roles rather than one per shell — the fields, the
// guarantees and the audit trail are identical, only the landing link differs.
export default async function AccountPage() {
  const { supabase, user } = await requireUser();
  const role = await getUserRole(supabase);

  const [{ data: profile }, { data: roles }, { data: activity }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, contact, address, locale, avatar_path, created_at, updated_at")
      .eq("id", user.id)
      .single(),
    supabase.from("user_roles").select("role, staff_code").eq("user_id", user.id),
    // Readable thanks to the audit_log_self_select policy: every user sees what they did,
    // only an admin sees what everyone did.
    supabase
      .from("audit_log")
      .select("id, action, entity, at")
      .eq("actor_id", user.id)
      .order("at", { ascending: false })
      .limit(15),
  ]);

  // The bucket is private, so the image is reached through a short-lived signed URL rather
  // than a guessable public path.
  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, 60 * 60);
    avatarUrl = data?.signedUrl ?? null;
  }

  const initial = (profile?.full_name?.trim()[0] ?? user.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 sm:p-10">
      <div>
        <Link href={roleLandingPath(role ?? "parent")} className="text-sm text-[var(--color-primary)]">
          ← ড্যাশবোর্ডে ফিরুন
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">আমার অ্যাকাউন্ট</h1>
        <p className="text-sm text-[var(--color-muted)]">
          ব্যক্তিগত তথ্য, নিরাপত্তা ও অ্যাকাউন্ট কার্যক্রম
        </p>
      </header>

      {/* Identity is read-only on purpose: the database rejects any attempt to change these
          codes, so the UI must not imply otherwise by rendering them as inputs. */}
      <Section title="পরিচিতি">
        <dl className="grid grid-cols-1 gap-4 p-4 text-sm sm:grid-cols-4">
          {(roles ?? []).map((r) => (
            <Field
              key={r.staff_code}
              label={ID_LABEL_BN[r.role] ?? "আইডি"}
              value={<span className="font-mono tracking-wide">{r.staff_code}</span>}
              hint="অপরিবর্তনীয়"
            />
          ))}
          <Field label="ভূমিকা" value={role ? (ROLE_BN[role] ?? role) : "—"} />
          <Field label="নিবন্ধন" value={dateBn(profile?.created_at)} />
          <Field label="সর্বশেষ হালনাগাদ" value={dateBn(profile?.updated_at)} />
        </dl>
      </Section>

      <Section title="প্রোফাইল ছবি">
        <div className="p-4">
          <AvatarForm avatarUrl={avatarUrl} initial={initial} />
        </div>
      </Section>

      <Section title="ব্যক্তিগত তথ্য">
        <div className="p-4">
          <ProfileForm
            fullName={profile?.full_name ?? ""}
            contact={profile?.contact ?? ""}
            address={profile?.address ?? ""}
            locale={profile?.locale ?? "bn"}
          />
        </div>
      </Section>

      <Section title="ইমেইল ঠিকানা">
        <div className="p-4">
          <EmailForm email={user.email ?? ""} />
        </div>
      </Section>

      <Section title="পাসওয়ার্ড">
        <div className="p-4">
          <PasswordForm />
        </div>
      </Section>

      <Section title="অ্যাকাউন্ট কার্যক্রম">
        {activity && activity.length > 0 ? (
          <ul className="divide-y divide-[var(--color-border)]">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
                <span>{auditLabel(a.action)}</span>
                <span className="font-mono text-xs text-[var(--color-muted)]">{a.entity}</span>
                <span className="text-xs text-[var(--color-muted)]">{dateBn(a.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-[var(--color-muted)]">
            এখনো কোনো কার্যক্রম রেকর্ড হয়নি।
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)]">
      <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
      <dd>{value}</dd>
      {hint && <p className="text-[10px] text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}
