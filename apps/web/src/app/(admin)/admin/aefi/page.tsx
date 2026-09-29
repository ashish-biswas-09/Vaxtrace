import { requireAppRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/kit";
import { Callout } from "../_components/Callout";
import {
  ListControls,
  PAGE_SIZE,
  Pager,
  hrefWith,
  pageOf,
  sanitizeSearch,
} from "../_components/ListControls";
import { AefiTable, type AefiRow } from "./_components/AefiTable";
export const metadata = { title: "AEFI" };

export const dynamic = "force-dynamic";

const FILTERS = ["overdue", "serious", "open", "classified", "closed"] as const;
type Filter = (typeof FILTERS)[number];
const BASE = "/admin/aefi";

// AEFI case management (report BS-12, FR-22).
//
// A note cannot be assigned, investigated, classified against the WHO causality categories,
// linked to the batch it might implicate, or counted — hence a workflow rather than a text box.
//
// Ordered by urgency, not by onset date (K-15): a serious case past its 48-hour investigation
// deadline is the row somebody has to act on, so it comes first, then open cases by severity.
export default async function AefiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase } = await requireAppRole("supervisor");
  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const filter = FILTERS.includes(sp.filter as Filter) ? (sp.filter as Filter) : undefined;
  const page = pageOf(sp.page);
  const params = { q: q || undefined, filter };

  const count = () => supabase.from("v_aefi_cases").select("id", { count: "exact", head: true });
  const OPEN = ["reported", "under_investigation"] as const;

  let list = supabase
    .from("v_aefi_cases")
    .select(
      "id, code, status, severity, outcome, causality, onset_date, symptoms, investigation_note, child_id, child_code, child_name, area_name_bn, facility_name_bn, vaccine_name_bn, vaccine_code, batch_number, reported_by_name, investigated_by_name, investigation_overdue",
      { count: "exact" },
    );
  if (filter === "overdue") list = list.eq("investigation_overdue", true);
  if (filter === "serious") list = list.eq("severity", "serious");
  if (filter === "open") list = list.in("status", [...OPEN]);
  if (filter === "classified") list = list.eq("status", "classified");
  if (filter === "closed") list = list.eq("status", "closed");
  if (q) {
    list = list.or(
      ["code", "child_name", "child_code", "symptoms", "batch_number", "vaccine_name_bn"]
        .map((c) => `${c}.ilike.%${q}%`)
        .join(","),
    );
  }
  list = list
    .order("investigation_overdue", { ascending: false })
    .order("status", { ascending: true })
    .order("severity", { ascending: false })
    .order("reported_at", { ascending: true })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const [all, serious, open, overdue, classified, closed, { data: cases, count: total, error }] =
    await Promise.all([
      count(),
      count().eq("severity", "serious"),
      count().in("status", [...OPEN]),
      count().eq("investigation_overdue", true),
      count().eq("status", "classified"),
      count().eq("status", "closed"),
      list,
    ]);
  if (error) console.error("v_aefi_cases", error);

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

  const n = {
    all: all.count ?? 0,
    serious: serious.count ?? 0,
    open: open.count ?? 0,
    overdue: overdue.count ?? 0,
    classified: classified.count ?? 0,
    closed: closed.count ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="টিকা-পরবর্তী বিরূপ প্রতিক্রিয়া (AEFI)"
        description="রিপোর্ট হওয়া প্রতিটি AEFI-এর তদন্ত ও WHO শ্রেণিবিন্যাস এখানে করুন। মারাত্মক কেসের তদন্ত ৪৮ ঘণ্টার মধ্যে শুরু করতে হবে।"
      />

      {n.overdue > 0 && (
        <Callout
          tone="danger"
          title={`${toBn(n.overdue)}টি মারাত্মক কেসের তদন্ত ৪৮ ঘণ্টা পেরিয়েছে`}
          href={hrefWith(BASE, {}, { filter: "overdue" })}
          hrefLabel="কেসগুলো দেখুন"
        />
      )}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="মোট কেস" value={toBn(n.all)} />
        <StatCard
          label="মারাত্মক"
          value={toBn(n.serious)}
          tone={n.serious > 0 ? "danger" : "success"}
          hint="ভর্তি, স্থায়ী ক্ষতি, প্রাণঘাতী বা মৃত্যু"
          href={hrefWith(BASE, {}, { filter: "serious" })}
        />
        <StatCard
          label="খোলা কেস"
          value={toBn(n.open)}
          tone={n.open > 0 ? "warning" : "success"}
          hint="রিপোর্টকৃত বা তদন্তাধীন"
          href={hrefWith(BASE, {}, { filter: "open" })}
        />
        <StatCard
          label="তদন্তে বিলম্ব"
          value={toBn(n.overdue)}
          tone={n.overdue > 0 ? "danger" : "success"}
          hint="মারাত্মক কেস, ৪৮ ঘণ্টার বেশি অনিষ্পন্ন"
          href={hrefWith(BASE, {}, { filter: "overdue" })}
        />
      </section>

      {n.all === 0 && !error ? (
        <EmptyState
          title="কোনো AEFI কেস নেই"
          hint="টিকার রেকর্ডে বিরূপ প্রতিক্রিয়া লেখা হলে কেস এখানে দেখা যাবে।"
        />
      ) : (
        <>
          <ListControls
            base={BASE}
            params={params}
            searchPlaceholder="কেস, শিশু, উপসর্গ বা ব্যাচ…"
            chips={[
              { value: "overdue", label: "বিলম্বিত", count: n.overdue },
              { value: "serious", label: "মারাত্মক", count: n.serious },
              { value: "open", label: "খোলা", count: n.open },
              { value: "classified", label: "শ্রেণিবদ্ধ", count: n.classified },
              { value: "closed", label: "নিষ্পন্ন", count: n.closed },
            ]}
          />
          {error ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              কেসের তালিকা দেখানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।
            </p>
          ) : (
            <AefiTable rows={rows} empty="এই ফিল্টারে কোনো কেস নেই।" />
          )}
          <Pager base={BASE} params={params} page={page} total={total ?? 0} />
        </>
      )}
    </div>
  );
}
