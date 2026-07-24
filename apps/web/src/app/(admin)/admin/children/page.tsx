import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { childCoverage } from "./coverage";
import { ChildrenTable, type ChildRow } from "./_components/ChildrenTable";

export const dynamic = "force-dynamic";

export default async function ChildrenPage() {
  const supabase = await requireRole("admin");

  const [{ data: kids }, { data: scheds }] = await Promise.all([
    supabase
      .from("children")
      .select("id, full_name, date_of_birth, gender, guardian_id, guardian_contact, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("schedules").select("child_id, status, due_date"),
  ]);

  const guardianIds = [...new Set((kids ?? []).map((k) => k.guardian_id))];
  const { data: guardians } = guardianIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", guardianIds)
    : { data: [] };
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g.full_name]));

  const today = new Date().toISOString().slice(0, 10);
  const rateFor = childCoverage(scheds ?? [], today);

  const rows: ChildRow[] = (kids ?? []).map((k) => ({
    id: k.id,
    full_name: k.full_name,
    date_of_birth: k.date_of_birth,
    gender: k.gender,
    guardian_name: guardianById.get(k.guardian_id) ?? null,
    guardian_contact: k.guardian_contact,
    created_at: k.created_at,
    coverage: rateFor(k.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">শিশু</h1>
        <p className="text-sm text-[var(--color-muted)]">
          মোট {toBn(rows.length)} জন নিবন্ধিত শিশু — নিবন্ধনের সময় অনুসারে সাজানো
        </p>
      </header>
      <ChildrenTable rows={rows} />
    </div>
  );
}
