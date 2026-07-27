import { mfaGate, requireAppRole } from "@/lib/auth";
import { dateTimeBn, toBn } from "@/lib/format";
import { StatCard, StatusBadge } from "@/components/ui/kit";
import { ReviewButton } from "./_components/ReviewButton";
export const metadata = { title: "জরুরি প্রবেশাধিকার" };

export const dynamic = "force-dynamic";

// Break-glass review (report FR-76 / SEC-12 / ADR-019).
//
// Cross-scope access happens legitimately — a child from another district turns up at a
// session. Forbidding it outright gets the system worked around: the worker registers a
// duplicate instead, and the register is worse off than if the read had been allowed. So it is
// allowed, it costs a written reason, and it lands here where a supervisor reads it.
//
// A control nobody reviews is theatre. This screen is the review.
export default async function BreakGlassPage() {
  const { supabase, claims } = await requireAppRole("supervisor");
  await mfaGate(supabase, claims);

  // "Still active" is decided by Postgres, not by this process: expires_at is a database
  // timestamp, and a web server whose clock has drifted would otherwise draw a grant as
  // expired while the policy still honours it. `gt.now()` is evaluated server-side.
  const [{ data: events }, { data: activeRows }] = await Promise.all([
    supabase
      .from("break_glass_access")
      .select("id, user_id, child_id, reason, granted_at, expires_at, reviewed_at, reviewed_by")
      .order("granted_at", { ascending: false })
      .limit(200),
    supabase.from("break_glass_access").select("id").gt("expires_at", "now()"),
  ]);

  const rows = events ?? [];
  const activeIds = new Set((activeRows ?? []).map((r) => r.id));
  const userIds = [...new Set(rows.flatMap((r) => [r.user_id, r.reviewed_by].filter(Boolean)))];
  const childIds = [...new Set(rows.map((r) => r.child_id))];

  const [{ data: profiles }, { data: children }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds as string[])
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    childIds.length
      ? supabase.from("children").select("id, child_id, full_name").in("id", childIds)
      : Promise.resolve({ data: [] as { id: string; child_id: string; full_name: string }[] }),
  ]);

  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const childOf = new Map((children ?? []).map((c) => [c.id, c]));

  const pending = rows.filter((r) => !r.reviewed_at);
  const active = rows.filter((r) => activeIds.has(r.id));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">জরুরি প্রবেশাধিকার পর্যালোচনা</h1>
        <p className="text-sm text-[var(--color-muted)]">
          নিজের এলাকার বাইরের কোনো শিশুর তথ্য দেখতে হলে কর্মীকে কারণ লিখতে হয়। প্রতিটি এমন
          প্রবেশাধিকার এখানে জমা হয় — নিষিদ্ধ করলে কর্মীরা বিকল্প পথ খোঁজেন, কিন্তু লিপিবদ্ধ
          করলে ব্যবস্থাটি সৎ থাকে।
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="মোট ঘটনা" value={toBn(rows.length)} hint="সর্বশেষ ২০০টি" />
        <StatCard
          label="পর্যালোচনা বাকি"
          value={toBn(pending.length)}
          tone={pending.length > 0 ? "warning" : "success"}
          hint="সুপারভাইজারের দেখা প্রয়োজন"
        />
        <StatCard
          label="এখনো সক্রিয়"
          value={toBn(active.length)}
          tone={active.length > 0 ? "danger" : "muted"}
          hint="৪ ঘণ্টা পর নিজে থেকেই শেষ হয়"
        />
      </section>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
          কোনো জরুরি প্রবেশাধিকার নেওয়া হয়নি।
        </p>
      ) : (
        <section className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  কর্মী
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  শিশু
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  কারণ
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  সময়
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  অবস্থা
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const child = childOf.get(r.child_id);
                const stillActive = activeIds.has(r.id);
                return (
                  <tr key={r.id} className="border-t border-[var(--color-border)] align-top">
                    <td className="px-4 py-3">{nameOf.get(r.user_id) ?? "—"}</td>
                    <td className="px-4 py-3">
                      {child ? (
                        <>
                          {child.full_name}
                          <span className="block font-mono text-xs text-[var(--color-muted)]">
                            {toBn(child.child_id)}
                          </span>
                        </>
                      ) : (
                        // The reviewer may be outside this child's scope themselves. The event
                        // is still reviewable — that is the point — but the record is not.
                        <span className="text-[var(--color-muted)]">পরিধির বাইরে</span>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-3">{r.reason}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                      {dateTimeBn(r.granted_at)}
                    </td>
                    <td className="px-4 py-3">
                      {r.reviewed_at ? (
                        <>
                          <StatusBadge tone="success">পর্যালোচিত</StatusBadge>
                          <span className="mt-1 block text-xs text-[var(--color-muted)]">
                            {r.reviewed_by ? (nameOf.get(r.reviewed_by) ?? "—") : "—"}
                          </span>
                        </>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <StatusBadge tone={stillActive ? "danger" : "warning"}>
                            {stillActive ? "সক্রিয়" : "বাকি"}
                          </StatusBadge>
                          <ReviewButton id={r.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
