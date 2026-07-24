import { requireRole } from "@/lib/auth";
import { toBn, ageBn, dateBn, pctBn } from "@/lib/format";
import { StatusBadge } from "../_components/ui";

export const dynamic = "force-dynamic";

const GENDER_BN: Record<string, string> = {
  male: "ছেলে",
  female: "মেয়ে",
  other: "অন্যান্য",
};

export default async function ChildrenPage() {
  const supabase = await requireRole("admin");

  const [{ data: kids }, { data: scheds }] = await Promise.all([
    supabase
      .from("children")
      .select("id, full_name, date_of_birth, gender, guardian_id, guardian_contact, created_at")
      .order("created_at", { ascending: false }),
    // ponytail: per-child coverage aggregated in app code (done ÷ due-to-date). Fine for the
    // demo dataset; add a v_child_coverage view if the registry grows to thousands of rows.
    supabase.from("schedules").select("child_id, status, due_date"),
  ]);

  const guardianIds = [...new Set((kids ?? []).map((k) => k.guardian_id))];
  const { data: guardians } = guardianIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", guardianIds)
    : { data: [] };
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g.full_name]));

  const today = new Date().toISOString().slice(0, 10);
  const cov = new Map<string, { due: number; done: number }>();
  for (const s of scheds ?? []) {
    const c = cov.get(s.child_id) ?? { due: 0, done: 0 };
    if (s.status === "done") c.done += 1;
    if (s.due_date <= today) c.due += 1;
    cov.set(s.child_id, c);
  }
  const rateFor = (id: string): number | null => {
    const c = cov.get(id);
    return c && c.due > 0 ? c.done / c.due : null;
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">শিশু</h1>
        <p className="text-sm text-[var(--color-muted)]">
          মোট {toBn((kids ?? []).length)} জন নিবন্ধিত শিশু — নিবন্ধনের সময় অনুসারে সাজানো
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">শিশু</th>
              <th className="px-4 py-3 font-medium">অভিভাবক</th>
              <th className="px-4 py-3 font-medium">যোগাযোগ</th>
              <th className="px-4 py-3 font-medium">টিকা কভারেজ</th>
              <th className="px-4 py-3 font-medium">নিবন্ধিত</th>
            </tr>
          </thead>
          <tbody>
            {(kids ?? []).map((k) => {
              const rate = rateFor(k.id);
              return (
                <tr key={k.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{k.full_name}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {ageBn(k.date_of_birth)} · {GENDER_BN[k.gender] ?? k.gender}
                    </div>
                  </td>
                  <td className="px-4 py-3">{guardianById.get(k.guardian_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {k.guardian_contact ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      tone={
                        rate == null
                          ? "muted"
                          : rate >= 0.8
                            ? "success"
                            : rate >= 0.5
                              ? "warning"
                              : "danger"
                      }
                    >
                      {pctBn(rate)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{dateBn(k.created_at)}</td>
                </tr>
              );
            })}
            {(kids ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  কোনো শিশু নিবন্ধিত নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
