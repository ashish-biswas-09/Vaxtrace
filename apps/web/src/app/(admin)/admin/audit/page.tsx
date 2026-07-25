import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { AuditTable, type AuditRow } from "./_components/AuditTable";

export const dynamic = "force-dynamic";

// ponytail: newest 500 rows fetched once, then searched/filtered/paged in the browser. Right
// while the log is small; swap to Supabase .range() + server-side filters when it isn't.
const LIMIT = 500;

export default async function AuditPage() {
  const supabase = await requireRole("admin");

  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, action, entity, entity_id, at, actor_id")
    .order("at", { ascending: false })
    .limit(LIMIT);

  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const nameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const list: AuditRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entity_id: r.entity_id,
    at: r.at,
    // Rows written by the nightly sweep and the schedule triggers have no actor. "সিস্টেম"
    // is the honest attribution — a blank cell reads like missing data.
    actor_name: r.actor_id ? (nameById.get(r.actor_id) ?? "—") : "সিস্টেম",
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">অডিট লগ</h1>
          <p className="text-sm text-[var(--color-muted)]">
            প্রতিটি প্রশাসনিক পরিবর্তনের অপরিবর্তনীয় রেকর্ড — সর্বশেষ {toBn(list.length)}টি
            {list.length === LIMIT && " (সীমা)"}
          </p>
        </div>
        <a
          href="/admin/audit/export"
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
        >
          CSV ডাউনলোড
        </a>
      </header>

      <AuditTable rows={list} />
    </div>
  );
}
