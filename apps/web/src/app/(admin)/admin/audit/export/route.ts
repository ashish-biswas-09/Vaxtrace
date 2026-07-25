import { requireRole } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { auditLabel } from "../../_audit";

// An immutable audit trail that cannot leave the screen is not usable as evidence — this is
// the "who changed this role / this record, and when" artefact. requireRole redirects
// non-admins, and audit_log's RLS is admin-only read, so the export cannot leak either way.
export async function GET() {
  const supabase = await requireRole("admin");

  const { data } = await supabase
    .from("audit_log")
    .select("id, action, entity, entity_id, at, actor_id")
    .order("at", { ascending: false })
    .limit(5000);

  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const nameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  // Both the raw action and its label: the label is readable, the raw string is what an
  // auditor greps for and is stable across UI copy changes.
  const csv = toCsv(
    ["at", "actor", "action", "action_label", "entity", "entity_id"],
    (data ?? []).map((r) => [
      r.at,
      r.actor_id ? (nameById.get(r.actor_id) ?? r.actor_id) : "system",
      r.action,
      auditLabel(r.action),
      r.entity,
      r.entity_id,
    ]),
  );

  return csvResponse(csv, "vaxtrace-audit-log.csv");
}
