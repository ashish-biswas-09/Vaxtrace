import { mfaGate, requireAppRole } from "@/lib/auth";
import { toBn, todayIso } from "@/lib/format";
import { LEVEL_LABEL_BN, nlevel, type LocationNode } from "@/lib/locations";
import { PageHeader, StatCard } from "@/components/ui/kit";
import { PrintButton } from "../_components/PrintButton";
import { PlanSessionForm } from "./_components/PlanSessionForm";
import { SessionsTable, type SessionRow } from "./_components/SessionsTable";
export const metadata = { title: "টিকাদান সেশন" };

export const dynamic = "force-dynamic";

// The session and campaign planner (report BS-03, §16.2).
//
// The tally column is the reason this screen exists rather than a calendar: a session that was
// planned, held, and served four children out of a target of thirty is a different fact from a
// session that was cancelled, and both are invisible if doses attach only to a facility. The
// numbers here come from v_session_tally, so the paper tally form has no separate existence to
// disagree with.
export default async function SessionsPage() {
  const { supabase, claims } = await requireAppRole("supervisor");
  await mfaGate(supabase, claims);

  const today = todayIso();

  const [{ data: tallies }, { data: sessions }, { data: facilities }, { data: locations }, { data: staff }] =
    await Promise.all([
      supabase
        .from("v_session_tally")
        .select("session_id, code, session_date, type, status, facility_name_bn, target_children, doses_given, children_served, doses_voided, aefi_flagged")
        .order("session_date", { ascending: false }),
      supabase.from("sessions").select("id, location_id, start_time, end_time, cancel_reason, team_lead"),
      supabase
        .from("facilities")
        .select("id, name_bn, type, location_id")
        .eq("is_active", true)
        .order("name_bn"),
      supabase
        .from("locations")
        .select("id, name_bn, name_en, level, path, parent_id")
        .is("valid_to", null)
        .order("path"),
      supabase
        .from("user_assignments")
        .select("user_id")
        .in("role", ["field_worker", "supervisor"])
        .is("valid_to", null),
    ]);

  const nodes = (locations ?? []) as LocationNode[];
  const byId = new Map(nodes.map((l) => [l.id, l]));
  const detail = new Map((sessions ?? []).map((s) => [s.id, s]));

  const rows: SessionRow[] = (tallies ?? []).map((t) => {
    const d = t.session_id ? detail.get(t.session_id) : undefined;
    const loc = d?.location_id ? byId.get(d.location_id) : undefined;
    return {
      id: t.session_id ?? "",
      code: t.code ?? "",
      date: t.session_date ?? "",
      type: t.type ?? "fixed",
      status: t.status ?? "planned",
      facility: t.facility_name_bn ?? "—",
      area: loc?.name_bn ?? "—",
      time:
        d?.start_time && d.end_time
          ? `${d.start_time.slice(0, 5)}–${d.end_time.slice(0, 5)}`
          : (d?.start_time?.slice(0, 5) ?? "—"),
      target: t.target_children,
      doses: Number(t.doses_given ?? 0),
      children: Number(t.children_served ?? 0),
      voided: Number(t.doses_voided ?? 0),
      aefi: Number(t.aefi_flagged ?? 0),
      cancel_reason: d?.cancel_reason ?? null,
    };
  });

  const upcoming = rows.filter((r) => r.status === "planned" && r.date >= today);
  const held = rows.filter((r) => r.status === "held");
  const cancelled = rows.filter((r) => r.status === "cancelled");
  // The cancellation rate over sessions that have reached their date — a planned session in
  // three weeks is not evidence of anything yet.
  const reached = held.length + cancelled.length;

  const staffIds = [...new Set((staff ?? []).map((s) => s.user_id))];
  const { data: staffProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const assignees = (staffProfiles ?? [])
    .map((p) => ({ id: p.id, name: p.full_name ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name, "bn"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="টিকাদান সেশন"
        description="নির্ধারিত কেন্দ্র, আউটরিচ ও ক্যাম্পেইন — কোথায়, কবে, কে। প্রতিটি ডোজ তার সেশনের সঙ্গে যুক্ত, তাই সেশনের ট্যালি আলাদা কাগজে রাখতে হয় না।"
        actions={<PrintButton label="ট্যালি ছাপুন" />}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <StatCard
          label="আসন্ন সেশন"
          value={toBn(upcoming.length)}
          tone="primary"
          hint="আজ বা তার পরে পরিকল্পিত"
        />
        <StatCard label="সম্পন্ন" value={toBn(held.length)} tone="success" hint="ডোজ নথিভুক্ত হয়েছে" />
        <StatCard
          label="বাতিল"
          value={toBn(cancelled.length)}
          tone={cancelled.length > 0 ? "warning" : "success"}
          hint={
            reached > 0
              ? `তারিখ পেরোনো সেশনের ${toBn(Math.round((cancelled.length / reached) * 100))}%`
              : "এখনো কোনো সেশনের তারিখ পেরোয়নি"
          }
        />
        <StatCard
          label="সম্পন্ন সেশনে প্রদত্ত ডোজ"
          value={toBn(held.reduce((n, r) => n + r.doses, 0))}
          hint={`${toBn(held.reduce((n, r) => n + r.children, 0))} জন শিশু`}
        />
      </section>

      <SessionsTable rows={rows} today={today} />

      <section className="rounded-xl border border-[var(--color-border)] p-5 print:hidden">
        <h2 className="mb-1 text-lg font-medium">নতুন সেশন পরিকল্পনা</h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          কেন্দ্র হলো <em>কে চালাচ্ছে</em>, এলাকা হলো <em>কোথায় হচ্ছে</em>। আউটরিচে দুটি আলাদা —
          কেন্দ্রের নিজের ওয়ার্ডের নামে আউটরিচ লিখলে যে ওয়ার্ডে সেবা পৌঁছায়নি সেটিও সেবা পেয়েছে
          বলে দেখাবে।
        </p>
        <PlanSessionForm
          facilities={(facilities ?? []).map((f) => ({
            id: f.id,
            label: f.name_bn,
            location_id: f.location_id,
          }))}
          locations={nodes.map((n) => ({
            id: n.id,
            depth: nlevel(n.path) - 1,
            label: `${n.name_bn} · ${LEVEL_LABEL_BN[n.level]}`,
          }))}
          staff={assignees}
          today={today}
        />
      </section>
    </div>
  );
}
