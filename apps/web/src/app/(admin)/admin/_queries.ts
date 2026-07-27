import { requireRole } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { batchStatus } from "./inventory/status";

// Dashboard data access, lifted out of the page so each zone can be awaited inside its own
// <Suspense>. The page previously ran three sequential waves — a Promise.all of eleven, then
// `vaccines`, then the actor lookup — and rendered nothing until the slowest of thirteen
// resolved. Now the alert rail paints without waiting on the coverage view.

export type Window = {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  days: number;
};

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Window of `days` ending today, plus the equal-length window immediately before it. */
export function buildWindow(days: number): Window {
  const end = todayIso();
  const start = shift(end, -(days - 1));
  return { start, end, prevStart: shift(start, -days), prevEnd: shift(start, -1), days };
}

export function windowDates(w: Window): string[] {
  return Array.from({ length: w.days }, (_, i) => shift(w.start, i));
}

function delta(current: number, previous: number) {
  const diff = current - previous;
  return {
    value: diff,
    percent: previous ? diff / previous : null,
    direction: (diff > 0 ? "up" : diff < 0 ? "down" : "flat") as "up" | "down" | "flat",
  };
}

/** Counts per ISO day across the window, zero-filled so a sparkline has no gaps. */
function daily(dates: (string | null | undefined)[], w: Window): number[] {
  const bucket = new Map<string, number>();
  for (const d of windowDates(w)) bucket.set(d, 0);
  for (const raw of dates) {
    if (!raw) continue;
    const key = raw.slice(0, 10);
    if (bucket.has(key)) bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }
  return [...bucket.values()];
}

// ── KPIs ────────────────────────────────────────────────────────────────────────
//
// Four cards, down from nine. The other five — untraced follow-ups, zero-dose, stock,
// cold chain, AEFI — are alerts, not indicators: each means "somebody must act", which is
// what the alert rail and the queues are for. Dropout and average coverage move to Reports,
// where the denominator is visible next to them.
//
// Three of the four carry a period-over-period comparison. "দেয় ডোজ" deliberately does not:
// it is a stock (how many doses are overdue right now), not a flow, and there is no history
// table to reconstruct what that stock was thirty days ago. An arrow there would be a guess.
// It gets a sparkline of doses falling due per day instead — derivable, and it answers the
// same "is this building up?" question.

export async function getKpis(w: Window) {
  const supabase = await requireRole("admin");

  const [administered, missed, dueNow, dueDates, kids, kidsTotal] = await Promise.all([
    supabase
      .from("vaccination_records")
      .select("administered_date")
      .gte("administered_date", w.prevStart)
      .lte("administered_date", w.end),
    supabase
      .from("schedules")
      .select("due_date")
      .eq("status", "missed")
      .gte("due_date", w.prevStart)
      .lte("due_date", w.end),
    supabase
      .from("schedules")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("due_date", w.end),
    supabase.from("schedules").select("due_date").gte("due_date", w.start).lte("due_date", w.end),
    supabase
      .from("children")
      .select("created_at")
      .gte("created_at", w.prevStart)
      .lte("created_at", `${w.end}T23:59:59`),
    supabase.from("children").select("*", { count: "exact", head: true }),
  ]);

  const inWindow = (rows: Record<string, string | null>[] | null, key: string) =>
    (rows ?? []).filter((r) => (r[key] ?? "") >= w.start).length;
  const inPrev = (rows: Record<string, string | null>[] | null, key: string) =>
    (rows ?? []).filter((r) => {
      const v = r[key] ?? "";
      return v >= w.prevStart && v <= `${w.prevEnd}T23:59:59`;
    }).length;

  const doseNow = inWindow(administered.data, "administered_date");
  const dosePrev = inPrev(administered.data, "administered_date");
  const missNow = inWindow(missed.data, "due_date");
  const missPrev = inPrev(missed.data, "due_date");
  const newNow = inWindow(kids.data, "created_at");
  const newPrev = inPrev(kids.data, "created_at");

  return {
    administered: {
      value: doseNow,
      delta: delta(doseNow, dosePrev),
      spark: daily(
        (administered.data ?? [])
          .map((r) => r.administered_date)
          .filter((d): d is string => !!d && d >= w.start),
        w,
      ),
    },
    missed: { value: missNow, delta: delta(missNow, missPrev) },
    dueNow: {
      value: dueNow.count ?? 0,
      spark: daily(
        (dueDates.data ?? []).map((r) => r.due_date),
        w,
      ),
    },
    children: {
      total: kidsTotal.count ?? 0,
      delta: delta(newNow, newPrev),
      spark: daily(
        (kids.data ?? []).map((r) => r.created_at),
        w,
      ),
    },
  };
}

// ── Alert rail ──────────────────────────────────────────────────────────────────

export async function getAlerts() {
  const supabase = await requireRole("admin");

  const [{ data: aefi }, { data: stock }, { data: coldChain }, { data: defaulters }] =
    await Promise.all([
      supabase
        .from("v_aefi_cases")
        .select("id, child_id, child_name, child_code, vaccine_name_bn, onset_date, symptoms, investigation_overdue")
        .in("status", ["reported", "under_investigation"])
        .order("onset_date", { ascending: false })
        .limit(5),
      supabase.from("inventories").select("stock_quantity, expiry_date"),
      supabase.from("v_cold_chain").select("device_id, has_excursion, is_silent, is_active"),
      supabase.from("v_defaulters").select("child_id, has_open_task"),
    ]);

  return {
    // An open serious case past its investigation deadline is the one line on this dashboard
    // that means somebody has to be telephoned. It leads.
    aefiOverdue: (aefi ?? []).filter((r) => r.investigation_overdue),
    aefiOpen: (aefi ?? []).length,
    expiredBatches: (stock ?? []).filter(
      (b) => batchStatus(b.stock_quantity, b.expiry_date).label === "মেয়াদোত্তীর্ণ",
    ).length,
    coldChain: (coldChain ?? []).filter((d) => d.is_active && (d.has_excursion || d.is_silent))
      .length,
    untraced: (defaulters ?? []).filter((d) => !d.has_open_task).length,
  };
}

// ── Trends ──────────────────────────────────────────────────────────────────────

export async function getCoverage() {
  const supabase = await requireRole("admin");
  const { data } = await supabase
    .from("v_coverage")
    .select("code, name_bn, coverage_rate, done_count, due_count")
    .order("code");
  return data ?? [];
}

export async function getDoseTrend(w: Window) {
  const supabase = await requireRole("admin");
  const { data } = await supabase
    .from("vaccination_records")
    .select("administered_date")
    .gte("administered_date", w.start)
    .lte("administered_date", w.end);
  return daily(
    (data ?? []).map((r) => r.administered_date),
    w,
  );
}

// ── Act-now queues ──────────────────────────────────────────────────────────────

export async function getStockQueue() {
  const supabase = await requireRole("admin");
  const [{ data: batches }, { data: vaccines }] = await Promise.all([
    supabase
      .from("inventories")
      .select("id, vaccine_id, batch_number, stock_quantity, expiry_date")
      .order("expiry_date", { ascending: true }),
    supabase.from("vaccines").select("id, name_bn"),
  ]);
  const vaxById = new Map((vaccines ?? []).map((v) => [v.id, v.name_bn]));

  return (batches ?? [])
    .map((b) => ({ ...b, status: batchStatus(b.stock_quantity, b.expiry_date) }))
    .filter((b) => b.status.tone !== "success")
    .slice(0, 5)
    .map((b) => ({
      id: b.id,
      vaccine: vaxById.get(b.vaccine_id) ?? "—",
      batch: b.batch_number,
      qty: b.stock_quantity,
      expiry: b.expiry_date,
      tone: b.status.tone,
      label: b.status.label,
    }));
}

/** The call-list: children furthest overdue whom nobody has been assigned to visit. */
export async function getDefaulterQueue() {
  const supabase = await requireRole("admin");
  const { data } = await supabase
    .from("v_defaulters")
    .select("child_id, full_name, child_code, guardian_phone, doses_missed, days_overdue, has_open_task")
    .eq("has_open_task", false)
    .order("days_overdue", { ascending: false })
    .limit(5);
  return data ?? [];
}

export async function getFailedQueue() {
  const supabase = await requireRole("admin");
  const { data: rows } = await supabase
    .from("notifications")
    .select("id, recipient_id, channel, status, last_error, scheduled_for")
    .in("status", ["failed", "dead"])
    .order("scheduled_for", { ascending: false })
    .limit(5);

  // recipient_id is nullable since the guardian split — a queued row can outlive the profile
  // it was addressed to.
  const ids = [
    ...new Set((rows ?? []).map((r) => r.recipient_id).filter((id): id is string => !!id)),
  ];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (rows ?? []).map((r) => ({
    id: r.id,
    name: (r.recipient_id ? nameById.get(r.recipient_id) : null) ?? "—",
    channel: r.channel,
    status: r.status,
    error: r.last_error,
  }));
}

// ── Activity ────────────────────────────────────────────────────────────────────
//
// The audit *screen* is gone; the trail is not. This feed is what remains of it on the admin
// surface, and it is the only thing that answers "who changed this" without opening the
// database.

export async function getActivity() {
  const supabase = await requireRole("admin");
  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, action, at, actor_id")
    .order("at", { ascending: false })
    .limit(8);

  const ids = [...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return (rows ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    at: r.at,
    // Rows written by the nightly sweep and the schedule triggers have no actor. "সিস্টেম" is
    // the honest attribution — a blank cell reads like missing data.
    actor: r.actor_id ? (nameById.get(r.actor_id) ?? "—") : "সিস্টেম",
  }));
}

export async function getChildrenCount() {
  const supabase = await requireRole("admin");
  const { count } = await supabase.from("children").select("*", { count: "exact", head: true });
  return count ?? 0;
}
