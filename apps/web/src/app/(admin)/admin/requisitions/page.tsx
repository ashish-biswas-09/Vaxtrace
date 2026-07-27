import { mfaGate, requireAppRole } from "@/lib/auth";
import { toBn, todayIso } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui/kit";
import { NewRequisitionForm } from "./_components/NewRequisitionForm";
import { RequisitionList, type RequisitionRow } from "./_components/RequisitionList";
export const metadata = { title: "চাহিদাপত্র" };

export const dynamic = "force-dynamic";

// Requisitions — the other half of the supply chain (report FR-25).
//
// Stock does not only move, it is asked for. Without a request record a facility that ran out
// has no evidence it asked, the store that failed to supply has no queue, and "we never got the
// vaccine" and "we never requested it" are indistinguishable a month later at a review meeting.
export default async function RequisitionsPage() {
  const { supabase, claims } = await requireAppRole("store_keeper");
  await mfaGate(supabase, claims);

  const [{ data: reqs }, { data: lines }, { data: facilities }, { data: vaccines }] =
    await Promise.all([
      supabase
        .from("requisitions")
        .select("id, code, status, needed_by, note, from_facility_id, to_facility_id, requested_at, decided_at, decision_note, issued_at, received_at")
        .order("requested_at", { ascending: false }),
      supabase
        .from("requisition_lines")
        .select("requisition_id, vaccine_id, quantity_requested, quantity_approved, quantity_issued"),
      supabase.from("facilities").select("id, name_bn, is_store").eq("is_active", true).order("name_bn"),
      supabase.from("vaccines").select("id, code, name_bn").eq("is_active", true).order("code"),
    ]);

  const facilityById = new Map((facilities ?? []).map((f) => [f.id, f.name_bn]));
  const vaccineById = new Map((vaccines ?? []).map((v) => [v.id, v]));
  const linesByReq = new Map<string, typeof lines>();
  for (const l of lines ?? []) {
    const list = linesByReq.get(l.requisition_id) ?? [];
    list.push(l);
    linesByReq.set(l.requisition_id, list as NonNullable<typeof lines>);
  }

  const today = todayIso();

  const rows: RequisitionRow[] = (reqs ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    from: facilityById.get(r.from_facility_id) ?? "—",
    to: facilityById.get(r.to_facility_id) ?? "—",
    needed_by: r.needed_by,
    // A submitted request whose needed-by date has passed is the row that gets a store keeper
    // called. It is computed here rather than in the view because it depends on today.
    is_late: r.status === "submitted" && r.needed_by < today,
    note: r.note,
    decision_note: r.decision_note,
    lines: (linesByReq.get(r.id) ?? []).map((l) => ({
      vaccine_id: l.vaccine_id,
      vaccine: vaccineById.get(l.vaccine_id)?.name_bn ?? "—",
      requested: l.quantity_requested,
      approved: l.quantity_approved,
      issued: l.quantity_issued,
    })),
  }));

  const open = rows.filter((r) => r.status === "submitted").length;
  const awaitingIssue = rows.filter((r) => r.status === "approved").length;
  const inTransit = rows.filter((r) => r.status === "issued").length;
  const late = rows.filter((r) => r.is_late).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="চাহিদাপত্র"
        description="কোন কেন্দ্র কী চেয়েছে, কে সিদ্ধান্ত নিয়েছে, কতটা পাঠানো হয়েছে এবং পৌঁছেছে কি না। প্রেরণ করলে দুই গুদামের লেজারেই একসঙ্গে হিসাব ওঠে।"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="সিদ্ধান্তের অপেক্ষায়"
          value={toBn(open)}
          tone={open > 0 ? "warning" : "success"}
        />
        <StatCard label="প্রেরণের অপেক্ষায়" value={toBn(awaitingIssue)} tone="primary" />
        <StatCard label="পথে" value={toBn(inTransit)} hint="প্রেরিত, গ্রহণ নিশ্চিত হয়নি" />
        <StatCard
          label="সময় পেরিয়েছে"
          value={toBn(late)}
          tone={late > 0 ? "danger" : "success"}
          hint="প্রয়োজনের তারিখ পার, এখনো সিদ্ধান্ত হয়নি"
        />
      </section>

      <RequisitionList rows={rows} />

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-1 text-lg font-medium">নতুন চাহিদাপত্র</h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          সরবরাহকারী হিসেবে সেই কেন্দ্রগুলোই আসে যেগুলো গুদাম হিসেবে চিহ্নিত।
        </p>
        <NewRequisitionForm
          facilities={(facilities ?? []).map((f) => ({
            id: f.id,
            label: f.name_bn,
            is_store: f.is_store,
          }))}
          vaccines={(vaccines ?? []).map((v) => ({ id: v.id, label: `${v.name_bn} (${v.code})` }))}
          today={today}
        />
      </section>
    </div>
  );
}
