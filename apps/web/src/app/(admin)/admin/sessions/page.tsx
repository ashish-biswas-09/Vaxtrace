import Link from "next/link";
import { requireAppRole } from "@/lib/auth";
import { dateBn, toBn, todayIso } from "@/lib/format";
import {
  LEVEL_LABEL_BN,
  SESSION_SITE_LEVELS,
  catchmentRoot,
  type LocationNode,
} from "@/lib/locations";
import { selectAll } from "@/lib/paged";
import { sessionState, SESSION_STATE_BN } from "@/lib/programme";
import { PageHeader, StatCard } from "@/components/ui/kit";
import { PrintButton } from "../_components/PrintButton";
import {
  ListControls,
  PAGE_SIZE,
  Pager,
  hrefWith,
  pageOf,
  sanitizeSearch,
} from "../_components/ListControls";
import { PlanSessionDialog } from "./_components/PlanSessionForm";
import { SessionsTable, type SessionRow } from "./_components/SessionsTable";
export const metadata = { title: "টিকাদান সেশন" };

export const dynamic = "force-dynamic";

const FILTERS = ["upcoming", "unreported", "held", "cancelled", "outreach"] as const;
type Filter = (typeof FILTERS)[number];

const BASE = "/admin/sessions";

// The session and campaign planner (report BS-03, §16.2).
//
// The tally column is the reason this screen exists rather than a calendar: a session that was
// planned, held, and served four children out of a target of thirty is a different fact from a
// session that was cancelled. The numbers come from v_session_tally, so the paper tally form
// has no separate existence to disagree with.
//
// Paged, filtered and searched in the database (K-19): the stat cards are head-only counts and
// the table reads one page, so the screen costs the same at 100 sessions and at 100,000.
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase } = await requireAppRole("supervisor");
  const sp = await searchParams;
  const today = todayIso();

  const q = sanitizeSearch(sp.q);
  const filter = FILTERS.includes(sp.filter as Filter) ? (sp.filter as Filter) : undefined;
  const all = sp.all === "1";
  const page = all ? 0 : pageOf(sp.page);
  const params = { q: q || undefined, filter, all: all ? "1" : undefined };

  const count = () =>
    supabase.from("v_session_tally").select("session_id", { count: "exact", head: true });

  let list = supabase
    .from("v_session_tally")
    .select(
      "session_id, code, session_date, type, status, facility_name_bn, location_id, target_children, doses_given, children_served, doses_voided, aefi_flagged",
      { count: "exact" },
    );
  if (filter === "upcoming") list = list.eq("status", "planned").gte("session_date", today);
  if (filter === "unreported") list = list.eq("status", "planned").lt("session_date", today);
  if (filter === "held") list = list.eq("status", "held");
  if (filter === "cancelled") list = list.eq("status", "cancelled");
  if (filter === "outreach") list = list.eq("type", "outreach");
  if (q) list = list.or(`code.ilike.%${q}%,facility_name_bn.ilike.%${q}%`);
  list = list.order("session_date", { ascending: false }).order("code", { ascending: false });
  list = all ? list.limit(1000) : list.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const [
    upcoming,
    unreported,
    held,
    cancelled,
    outreach,
    heldTally,
    { data: tallies, count: total, error },
    { data: facilities },
    { data: locations },
    { data: staff },
  ] = await Promise.all([
    count().eq("status", "planned").gte("session_date", today),
    count().eq("status", "planned").lt("session_date", today),
    count().eq("status", "held"),
    count().eq("status", "cancelled"),
    count().eq("type", "outreach"),
    selectAll(() =>
      supabase
        .from("v_session_tally")
        .select("session_id, doses_given, children_served")
        .eq("status", "held")
        .order("session_id"),
    ),
    list,
    supabase.from("facilities").select("id, name_bn, type, location_id").eq("is_active", true).order("name_bn"),
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
  if (error) console.error("v_session_tally", error);

  // Times and cancellation reasons for this page's rows only.
  const ids = (tallies ?? []).map((t) => t.session_id).filter((id): id is string => !!id);
  const { data: details } = ids.length
    ? await supabase.from("sessions").select("id, start_time, end_time, cancel_reason").in("id", ids)
    : { data: [] as { id: string; start_time: string | null; end_time: string | null; cancel_reason: string | null }[] };

  const nodes = (locations ?? []) as LocationNode[];
  const byId = new Map(nodes.map((l) => [l.id, l]));
  const byPath = new Map(nodes.map((l) => [l.path, l]));
  const detail = new Map((details ?? []).map((s) => [s.id, s]));
  const hhmm = (t: string | null | undefined) => (t ? toBn(t.slice(0, 5)) : null);

  const rows: SessionRow[] = (tallies ?? []).map((t) => {
    const d = t.session_id ? detail.get(t.session_id) : undefined;
    const start = hhmm(d?.start_time);
    const end = hhmm(d?.end_time);
    return {
      id: t.session_id ?? "",
      code: t.code ?? "",
      date: t.session_date ?? "",
      type: t.type ?? "fixed",
      state: sessionState(t.status ?? "planned", t.session_date ?? "", today),
      facility: t.facility_name_bn ?? "—",
      area: (t.location_id && byId.get(t.location_id)?.name_bn) || "—",
      time: start && end ? `${start}–${end}` : (start ?? "—"),
      target: t.target_children,
      doses: Number(t.doses_given ?? 0),
      children: Number(t.children_served ?? 0),
      aefi: Number(t.aefi_flagged ?? 0),
      cancel_reason: d?.cancel_reason ?? null,
    };
  });

  const n = {
    upcoming: upcoming.count ?? 0,
    unreported: unreported.count ?? 0,
    held: held.count ?? 0,
    cancelled: cancelled.count ?? 0,
    outreach: outreach.count ?? 0,
  };
  // Every session whose date has passed is evidence: held, cancelled, or never reported. The
  // unreported ones count against the rate too — leaving them out made it look better (K-05).
  const reached = n.held + n.cancelled + n.unreported;
  const heldDoses = heldTally.reduce((s, r) => s + Number(r.doses_given ?? 0), 0);
  const heldChildren = heldTally.reduce((s, r) => s + Number(r.children_served ?? 0), 0);

  // Team-lead fallback for before the session_staff() migration: names only resolve for the
  // roles profiles_select lets read other profiles.
  const staffIds = [...new Set((staff ?? []).map((s) => s.user_id))];
  const { data: staffProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const fallbackStaff = (staffProfiles ?? [])
    .map((p) => ({ id: p.id, name: p.full_name ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name, "bn"));

  const filterLabel = filter ? SESSION_STATE_BN[filter as keyof typeof SESSION_STATE_BN]?.label ?? "আউটরিচ" : "সব";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="টিকাদান সেশন"
        description="স্থায়ী কেন্দ্র, আউটরিচ ও ক্যাম্পেইন সেশনের পরিকল্পনা ও ফলাফল। সেশনে দেওয়া ডোজ এখানে নিজে থেকে যোগ হয়।"
        actions={
          <>
            <PlanSessionDialog
              facilities={(facilities ?? []).map((f) => {
                const home = byId.get(f.location_id);
                return {
                  id: f.id,
                  label: f.name_bn,
                  location_id: f.location_id,
                  location_label: home ? `${home.name_bn} · ${LEVEL_LABEL_BN[home.level]}` : "—",
                  root: home ? catchmentRoot(home.path, byPath) : "",
                };
              })}
              sites={nodes
                .filter((l) => SESSION_SITE_LEVELS.includes(l.level))
                .map((l) => ({
                  id: l.id,
                  path: l.path,
                  label: `${l.name_bn} · ${LEVEL_LABEL_BN[l.level]}${
                    l.parent_id && byId.get(l.parent_id) ? ` (${byId.get(l.parent_id)!.name_bn})` : ""
                  }`,
                }))}
              fallbackStaff={fallbackStaff}
              today={today}
            />
            <PrintButton />
          </>
        }
      />

      {/* On paper the controls are gone, so the sheet says what it lists. */}
      <div className="print-only text-sm">
        <p>
          <strong>টিকাদান সেশন</strong> · <strong>ফিল্টার:</strong> {filterLabel}
          {q && ` · খোঁজ: ${q}`} · <strong>সারি:</strong> {toBn(rows.length)} / {toBn(total ?? 0)} ·{" "}
          <strong>প্রিন্টের তারিখ:</strong> {dateBn(today)}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4 print:hidden">
        <StatCard
          label="আসন্ন সেশন"
          value={toBn(n.upcoming)}
          tone="primary"
          hint="আজ বা পরে পরিকল্পিত"
          href={hrefWith(BASE, {}, { filter: "upcoming" })}
        />
        <StatCard
          label="রিপোর্ট হয়নি"
          value={toBn(n.unreported)}
          tone={n.unreported > 0 ? "warning" : "success"}
          hint="তারিখ পেরিয়েছে, কোনো ডোজ বা বাতিলের তথ্য নেই"
          href={hrefWith(BASE, {}, { filter: "unreported" })}
        />
        <StatCard
          label="সম্পন্ন"
          value={toBn(n.held)}
          tone="success"
          hint={`অন্তত একটি ডোজ নথিভুক্ত · মোট ${toBn(heldDoses)} ডোজ, ${toBn(heldChildren)} জন শিশু`}
        />
        <StatCard
          label="বাতিল"
          value={toBn(n.cancelled)}
          tone={n.cancelled > 0 ? "warning" : "success"}
          hint={
            reached > 0
              ? `তারিখ পেরোনো সেশনের ${toBn(Math.round((n.cancelled / reached) * 100))}% (রিপোর্ট না হওয়া সেশনসহ)`
              : "এখনো কোনো সেশনের তারিখ পেরোয়নি"
          }
        />
      </section>

      <ListControls
        base={BASE}
        params={params}
        searchPlaceholder="সেশন কোড বা কেন্দ্র…"
        chips={[
          { value: "upcoming", label: "আসন্ন", count: n.upcoming },
          { value: "unreported", label: "রিপোর্ট হয়নি", count: n.unreported },
          { value: "held", label: "সম্পন্ন", count: n.held },
          { value: "cancelled", label: "বাতিল", count: n.cancelled },
          { value: "outreach", label: "আউটরিচ", count: n.outreach },
        ]}
      />

      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          সেশনের তালিকা দেখানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।
        </p>
      ) : (
        <SessionsTable
          rows={rows}
          empty={q || filter ? "এই ফিল্টারে কোনো সেশন নেই।" : "এখনো কোনো সেশন পরিকল্পনা করা হয়নি।"}
        />
      )}

      <Pager base={BASE} params={params} page={page} total={total ?? 0} />
      {(total ?? 0) > PAGE_SIZE && (
        <p className="text-xs print:hidden">
          {all ? (
            <Link href={hrefWith(BASE, params, { all: undefined })} className="text-[var(--accent)]">
              পৃষ্ঠা অনুযায়ী দেখান
            </Link>
          ) : (
            <Link href={hrefWith(BASE, params, { all: "1", page: undefined })} className="text-[var(--accent)]">
              সব সারি একসাথে দেখান (প্রিন্টের জন্য)
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
