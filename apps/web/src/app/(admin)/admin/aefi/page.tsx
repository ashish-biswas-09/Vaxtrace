import { mfaGate, requireAppRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { EmptyState, PageHeader, StatCard } from "../_components/ui";
import { AefiTable, type AefiRow } from "./_components/AefiTable";

export const dynamic = "force-dynamic";

// AEFI case management (report BS-12, FR-22).
//
// This used to be a nullable text column on the dose record. A note cannot be assigned,
// investigated, classified against the WHO causality categories, linked to the batch it might
// implicate, or counted. A single serious adverse event mishandled costs a programme more
// coverage than a year of outreach earns it — hence a workflow rather than a bigger text box.
//
// The text box still exists where a worker actually types at the session table; what changed is
// that typing in it now raises a case here, so the note reaches somebody whose job is to read
// it.
export default async function AefiPage() {
  const { supabase, claims } = await requireAppRole("supervisor");
  await mfaGate(supabase, claims);

  const { data: cases } = await supabase
    .from("v_aefi_cases")
    .select("id, code, status, severity, outcome, causality, onset_date, reported_at, symptoms, investigation_note, child_id, child_code, child_name, area_name_bn, facility_name_bn, vaccine_name_bn, vaccine_code, batch_number, reported_by_name, investigated_by_name, investigation_overdue")
    .order("onset_date", { ascending: false });

  const rows: AefiRow[] = (cases ?? []).map((c) => ({
    id: c.id ?? "",
    code: c.code ?? "",
    status: c.status ?? "reported",
    severity: c.severity ?? "minor",
    outcome: c.outcome ?? "unknown",
    causality: c.causality ?? null,
    onset_date: c.onset_date ?? "",
    symptoms: c.symptoms ?? "",
    note: c.investigation_note ?? null,
    child_id: c.child_id ?? "",
    child_code: c.child_code ?? "",
    child_name: c.child_name ?? "",
    area: c.area_name_bn ?? "—",
    facility: c.facility_name_bn ?? "—",
    vaccine: c.vaccine_name_bn ? `${c.vaccine_name_bn} (${c.vaccine_code})` : "—",
    batch: c.batch_number ?? null,
    reported_by: c.reported_by_name ?? "—",
    investigated_by: c.investigated_by_name ?? null,
    overdue: Boolean(c.investigation_overdue),
  }));

  const serious = rows.filter((r) => r.severity === "serious").length;
  const open = rows.filter((r) => r.status === "reported" || r.status === "under_investigation")
    .length;
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="টিকা-পরবর্তী বিরূপ ঘটনা (AEFI)"
        description="প্রতিটি ঘটনা একটি কেস — কোন টিকা, কোন ব্যাচ, কী উপসর্গ, কে তদন্ত করল, এবং WHO-র শ্রেণিবিন্যাস অনুযায়ী কার্যকারণ কী। ব্যাচের সঙ্গে যোগসূত্রটিই রিকলের সময় প্রশ্নের উত্তর দেয়।"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="মোট কেস" value={toBn(rows.length)} />
        <StatCard
          label="মারাত্মক"
          value={toBn(serious)}
          tone={serious > 0 ? "danger" : "success"}
          hint="মৃত্যু, হাসপাতালে ভর্তি, স্থায়ী ক্ষতি বা জীবনসংশয়"
        />
        <StatCard label="খোলা কেস" value={toBn(open)} tone={open > 0 ? "warning" : "success"} />
        <StatCard
          label="তদন্তে বিলম্ব"
          value={toBn(overdue)}
          tone={overdue > 0 ? "danger" : "success"}
          hint="মারাত্মক কেস, ৪৮ ঘণ্টার বেশি সময় ধরে অনিষ্পন্ন"
        />
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="কোনো AEFI কেস নেই"
          hint="কোনো ডোজের সঙ্গে বিরূপ প্রতিক্রিয়া লেখা হলে সেটি নিজে থেকেই এখানে কেস হিসেবে আসবে। শূন্য থাকা ভালো খবর, তবে মনে রাখুন — রিপোর্ট না হওয়া আর না ঘটা এক জিনিস নয়।"
        />
      ) : (
        <AefiTable rows={rows} />
      )}
    </div>
  );
}
