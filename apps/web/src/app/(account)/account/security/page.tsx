import Link from "next/link";
import { APP_ROLE_LABEL_BN, getClaims, requireUser } from "@/lib/auth";
import { dateTimeBn } from "@/lib/format";
import { StatusBadge } from "../../../(admin)/admin/_components/ui";
import { MfaDisablePanel, MfaEnrollPanel } from "./_components/MfaPanel";

export const dynamic = "force-dynamic";

// Account security (SEC-03 / FR-08). The database enforces MFA on the privileged surfaces —
// granting roles, editing the coverage denominator, changing system settings, reading the
// whole audit trail — via mfa_satisfied(). This screen is where a user can actually satisfy
// it, and where "you were sent here" is explained rather than presented as a failure.
export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const { required } = await searchParams;
  const { supabase } = await requireUser();
  const claims = await getClaims(supabase);

  const [{ data: factors }, { data: mfaRequired }, { data: profile }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.rpc("setting_bool", { p_key: "require_mfa_elevated" }),
    supabase
      .from("profiles")
      .select("phone, email, contact_verified_at")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .maybeSingle(),
  ]);

  const verified = (factors?.all ?? []).find((f) => f.status === "verified") ?? null;
  const atAal2 = claims?.aal === "aal2";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 sm:p-10">
      <div>
        <Link href="/account" className="text-sm text-[var(--color-primary)]">
          ← অ্যাকাউন্টে ফিরুন
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">নিরাপত্তা</h1>
        <p className="text-sm text-[var(--color-muted)]">
          দুই-ধাপ যাচাই ও যোগাযোগের তথ্যের অবস্থা।
        </p>
      </div>

      {required === "1" && !verified && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-warning)] px-4 py-3 text-sm text-[var(--color-warning)]"
        >
          আপনার দায়িত্বের স্তরে দুই-ধাপ যাচাই বাধ্যতামূলক। এটি চালু না করা পর্যন্ত ভূমিকা বরাদ্দ,
          সিস্টেম সেটিংস, জনসংখ্যার হিসাব ও সম্পূর্ণ অডিট লগ ব্যবহার করা যাবে না।
        </p>
      )}

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">দুই-ধাপ যাচাই (TOTP)</h2>
          {verified ? (
            <StatusBadge tone={atAal2 ? "success" : "warning"}>
              {atAal2 ? "চালু ও যাচাইকৃত" : "চালু — এই সেশনে যাচাই হয়নি"}
            </StatusBadge>
          ) : (
            <StatusBadge tone={mfaRequired ? "danger" : "muted"}>
              {mfaRequired ? "প্রয়োজন — চালু নেই" : "চালু নেই"}
            </StatusBadge>
          )}
        </div>

        <p className="mb-4 text-sm text-[var(--color-muted)]">
          আপনার ভূমিকা:{" "}
          <strong className="text-[var(--color-fg)]">
            {claims?.appRole ? APP_ROLE_LABEL_BN[claims.appRole] : "—"}
          </strong>
          । জেলা বা তার উপরের স্তরের দায়িত্বে দুই-ধাপ যাচাই বাধ্যতামূলক।
        </p>

        {verified ? <MfaDisablePanel factorId={verified.id} /> : <MfaEnrollPanel />}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-1 text-lg font-medium">যোগাযোগের তথ্য</h2>
        {/* SEC-14: the phone number is both the reminder channel and the account-recovery
            channel, so a change to it invalidates verification and is written to the audit
            log. Showing that state here is what makes "someone changed my number" visible to
            the person it happened to. */}
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          ফোন নম্বর পরিবর্তন করলে যাচাই বাতিল হয় এবং অডিট লগে রেকর্ড থাকে।
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">ফোন</dt>
            <dd className="font-mono">{profile?.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">ইমেইল</dt>
            <dd className="font-mono break-all">{profile?.email ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--color-muted)]">সর্বশেষ যাচাই</dt>
            <dd>
              {profile?.contact_verified_at ? (
                dateTimeBn(profile.contact_verified_at)
              ) : (
                <StatusBadge tone="warning">যাচাই হয়নি</StatusBadge>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
