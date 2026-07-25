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
      .select("id, child_id, full_name, date_of_birth, gender, guardian_id, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("schedules").select("child_id, status, due_date"),
  ]);

  // The guardian is a domain record now, not a profile — and it is the single source of truth
  // for the number reminders are sent to (BUG-11 was two columns disagreeing about that).
  const guardianIds = [...new Set((kids ?? []).map((k) => k.guardian_id))];
  const { data: guardians } = guardianIds.length
    ? await supabase.from("guardians").select("id, full_name, phone").in("id", guardianIds)
    : { data: [] as { id: string; full_name: string; phone: string }[] };
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g]));

  const rateFor = childCoverage(scheds ?? [], todayIso());

  const rows: ChildRow[] = (kids ?? []).map((k) => {
    const g = guardianById.get(k.guardian_id);
    return {
      id: k.id,
      child_id: k.child_id,
      full_name: k.full_name,
      date_of_birth: k.date_of_birth,
      gender: k.gender,
      guardian_name: g?.full_name ?? null,
      guardian_contact: g?.phone ?? null,
      status: k.status,
      created_at: k.created_at,
      coverage: rateFor(k.id),
    };
  });

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
