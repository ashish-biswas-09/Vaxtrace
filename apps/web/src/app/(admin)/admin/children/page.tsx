import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { toBn, todayIso } from "@/lib/format";
import { childCoverage } from "./coverage";
import { ChildrenTable, type ChildRow } from "./_components/ChildrenTable";

export const dynamic = "force-dynamic";

export default async function ChildrenPage() {
  const supabase = await requireRole("admin");

  const [{ data: kids }, { data: scheds }] = await Promise.all([
    supabase
      .from("children")
      .select(
        "id, child_id, full_name, date_of_birth, gender, guardian_id, guardian_contact, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("schedules").select("child_id, status, due_date"),
  ]);

  const guardianIds = [...new Set((kids ?? []).map((k) => k.guardian_id))];
  const { data: guardians } = guardianIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", guardianIds)
    : { data: [] };
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g.full_name]));

  const rateFor = childCoverage(scheds ?? [], todayIso());

  const rows: ChildRow[] = (kids ?? []).map((k) => ({
    id: k.id,
    child_id: k.child_id,
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">শিশু</h1>
          <p className="text-sm text-[var(--color-muted)]">
            মোট {toBn(rows.length)} জন নিবন্ধিত শিশু — নিবন্ধনের সময় অনুসারে সাজানো
          </p>
        </div>
        <Link
          href="/admin/children/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
        >
          + নতুন শিশু
        </Link>
      </header>
      <ChildrenTable rows={rows} />
    </div>
  );
}
