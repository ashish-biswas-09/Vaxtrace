import { requireRole } from "@/lib/auth";
import { toBn, todayIso } from "@/lib/format";
import { childCoverage, type Sched } from "./coverage";
import { selectAll } from "@/lib/paged";
import { ChildrenTable, type ChildRow } from "./_components/ChildrenTable";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui/kit";
export const metadata = { title: "শিশু" };

export const dynamic = "force-dynamic";

export default async function ChildrenPage() {
  const supabase = await requireRole("admin");

  const [{ data: kids }, scheds] = await Promise.all([
    supabase
      .from("children")
      .select("id, child_id, full_name, date_of_birth, gender, guardian_id, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    // Paged: one schedule row per child per dose is thousands of rows, and a plain select
    // stops at the PostgREST row cap without saying so — which showed as "—" coverage for
    // every child whose schedule rows fell past it.
    selectAll<Sched>(() =>
      supabase.from("schedules").select("child_id, status, due_date").order("child_id"),
    ),
  ]);

  // The guardian is a domain record now, not a profile — and it is the single source of truth
  // for the number reminders are sent to (BUG-11 was two columns disagreeing about that).
  const guardianIds = [...new Set((kids ?? []).map((k) => k.guardian_id))];
  const { data: guardians } = guardianIds.length
    ? await supabase.from("guardians").select("id, full_name, phone").in("id", guardianIds)
    : { data: [] as { id: string; full_name: string; phone: string }[] };
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g]));

  const rateFor = childCoverage(scheds, todayIso());

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
      <PageHeader
        title="শিশু"
        description={`মোট ${toBn(rows.length)} জন নিবন্ধিত শিশু — নিবন্ধনের সময় অনুসারে সাজানো`}
        actions={
          <Button href="/admin/children/new" icon={<PlusIcon size={16} />}>
            নতুন শিশু
          </Button>
        }
      />
      <ChildrenTable rows={rows} />
    </div>
  );
}
