import { requireRole } from "@/lib/auth";
import { dateBn } from "@/lib/format";
import { StatusBadge } from "../_components/ui";
import { auditLabel } from "../_audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const supabase = await requireRole("admin");

  // ponytail: newest 100 rows, no search/filter/export yet. The audit doc marks those 🟡;
  // add server-side pagination + filters when the log outgrows one screen.
  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, action, entity, entity_id, at, actor_id")
    .order("at", { ascending: false })
    .limit(100);

  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const nameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">অডিট লগ</h1>
        <p className="text-sm text-[var(--color-muted)]">
          প্রতিটি প্রশাসনিক পরিবর্তনের অপরিবর্তনীয় রেকর্ড — সর্বশেষ {(rows ?? []).length}টি
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">সময়</th>
              <th className="px-4 py-3 font-medium">ব্যবহারকারী</th>
              <th className="px-4 py-3 font-medium">কাজ</th>
              <th className="px-4 py-3 font-medium">এন্টিটি</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 text-[var(--color-muted)]">{dateBn(r.at)}</td>
                <td className="px-4 py-3">{nameById.get(r.actor_id ?? "") ?? "সিস্টেম"}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone="muted">{auditLabel(r.action)}</StatusBadge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted)]">
                  {r.entity}
                  {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  কোনো কার্যক্রম নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
