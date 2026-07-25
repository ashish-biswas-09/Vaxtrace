import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ageBn, dateBn, pctBn, toBn, todayIso } from "@/lib/format";
import { StatCard, StatusBadge } from "../../_components/ui";
import { buildHistory, summarise, type DoseStatus } from "./history";
import { DoseNote } from "./_components/DoseNote";

export const dynamic = "force-dynamic";

const GENDER_BN: Record<string, string> = { male: "ছেলে", female: "মেয়ে", other: "অন্যান্য" };

const STATUS_BN: Record<DoseStatus, { label: string; tone: "success" | "warning" | "danger" | "muted" }> = {
  done: { label: "সম্পন্ন", tone: "success" },
  due: { label: "দেয় আছে", tone: "warning" },
  missed: { label: "বাদ পড়েছে", tone: "danger" },
  upcoming: { label: "আসন্ন", tone: "muted" },
};

export default async function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireRole("admin");

  const { data: child } = await supabase
    .from("children")
    .select(
      "id, child_id, full_name, date_of_birth, gender, guardian_id, guardian_contact, created_at, created_by",
    )
    .eq("id", id)
    .maybeSingle();

  if (!child) notFound();

  const [{ data: scheds }, { data: records }, { data: vaccines }] = await Promise.all([
    supabase.from("schedules").select("vaccine_id, dose_number, due_date, status").eq("child_id", id),
    supabase
      .from("vaccination_records")
      .select(
        "id, vaccine_id, dose_number, administered_date, administered_by, batch_number, notes, adverse_event",
      )
      .eq("child_id", id),
    supabase.from("vaccines").select("id, code, name_bn"),
  ]);

  // People referenced by this child's record: the guardian, whoever registered them, and
  // every worker who administered a dose. One round trip instead of one per row.
  const personIds = [
    ...new Set(
      [
        child.guardian_id,
        child.created_by,
        ...(records ?? []).map((r) => r.administered_by),
      ].filter(Boolean) as string[],
    ),
  ];
  const [{ data: people }, { data: staffRoles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, contact").in("id", personIds),
    supabase.from("user_roles").select("user_id, role, staff_code").in("user_id", personIds),
  ]);
  const personById = new Map((people ?? []).map((p) => [p.id, p]));
  const codeByUser = new Map(
    (staffRoles ?? []).filter((r) => r.role !== "parent").map((r) => [r.user_id, r.staff_code]),
  );

  const vaccineById = new Map((vaccines ?? []).map((v) => [v.id, v]));
  const rows = buildHistory(scheds ?? [], records ?? [], todayIso());
  const stats = summarise(rows);

  const guardian = personById.get(child.guardian_id);
  const registrar = child.created_by ? personById.get(child.created_by) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/children" className="text-sm text-[var(--color-primary)]">
          ← শিশু তালিকা
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{child.full_name}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {ageBn(child.date_of_birth)} · {GENDER_BN[child.gender] ?? child.gender} · জন্ম{" "}
            {dateBn(child.date_of_birth)}
          </p>
        </div>
        {/* The Child ID is the system's primary identification number, so it gets headline
            treatment rather than being buried in a table cell. */}
        <div className="rounded-xl border border-[var(--color-primary)] px-4 py-2 text-right">
          <p className="text-xs text-[var(--color-muted)]">শিশু আইডি</p>
          <p className="font-mono text-xl tracking-widest">{toBn(child.child_id)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard
          label="কভারেজ"
          value={pctBn(stats.coverage)}
          tone={stats.coverage != null && stats.coverage >= 0.8 ? "success" : "warning"}
          hint="দেয় ডোজের মধ্যে সম্পন্ন"
        />
        <StatCard label="সম্পন্ন" value={toBn(stats.done)} tone="success" />
        <StatCard label="দেয় আছে" value={toBn(stats.due)} tone="warning" />
        <StatCard label="বাদ পড়েছে" value={toBn(stats.missed)} tone="danger" />
        <StatCard label="আসন্ন" value={toBn(stats.upcoming)} tone="muted" />
      </section>

      <section className="rounded-xl border border-[var(--color-border)]">
        <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          অভিভাবক ও নিবন্ধন
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="অভিভাবক" value={guardian?.full_name ?? "—"} />
          <Field label="যোগাযোগ" value={child.guardian_contact ?? guardian?.contact ?? "—"} />
          <Field label="নিবন্ধনকারী" value={registrar?.full_name ?? "—"} hint={registrar ? codeByUser.get(registrar.id) : undefined} />
          <Field label="নিবন্ধনের তারিখ" value={dateBn(child.created_at)} />
        </dl>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">টিকাদান ইতিহাস</h2>
          <p className="text-xs text-[var(--color-muted)]">
            মোট {toBn(stats.total)} ডোজ — সূচি ও প্রদত্ত ডোজ একত্রে
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">টিকা</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">ডোজ</th>
                <th scope="col" className="px-4 py-3 font-medium">নির্ধারিত</th>
                <th scope="col" className="px-4 py-3 font-medium">প্রদানের তারিখ</th>
                <th scope="col" className="px-4 py-3 font-medium">অবস্থা</th>
                <th scope="col" className="px-4 py-3 font-medium">স্বাস্থ্যকর্মী</th>
                <th scope="col" className="px-4 py-3 font-medium">ব্যাচ</th>
                <th scope="col" className="px-4 py-3 font-medium">মন্তব্য / বিরূপ প্রতিক্রিয়া</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = vaccineById.get(r.vaccine_id);
                const st = STATUS_BN[r.status];
                const worker = r.record ? personById.get(r.record.administered_by) : null;
                return (
                  <tr key={r.key} className="border-t border-[var(--color-border)] align-top">
                    <td className="px-4 py-3">
                      <div>{v?.name_bn ?? "—"}</div>
                      <div className="font-mono text-xs text-[var(--color-muted)]">{v?.code}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{toBn(r.dose_number)}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{dateBn(r.due_date)}</td>
                    <td className="px-4 py-3">{dateBn(r.record?.administered_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      {worker ? (
                        <>
                          <div>{worker.full_name}</div>
                          <div className="font-mono text-xs text-[var(--color-muted)]">
                            {codeByUser.get(worker.id) ?? ""}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted)]">
                      {r.record?.batch_number ?? "—"}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      {r.record ? (
                        <DoseNote
                          recordId={r.record.id}
                          childId={child.id}
                          notes={r.record.notes}
                          adverseEvent={r.record.adverse_event}
                        />
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    এই শিশুর কোনো সূচি বা ডোজ রেকর্ড নেই।
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

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
      <dd>
        {value}
        {hint && <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">{hint}</span>}
      </dd>
    </div>
  );
}
