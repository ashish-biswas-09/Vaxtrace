import { mfaGate, requireAppRole } from "@/lib/auth";
import { dateBn, toBn } from "@/lib/format";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/kit";
import { PrintButton } from "../_components/PrintButton";
import { RefreshBoardButton } from "./_components/RefreshBoardButton";
import { TracingBoard, type TaskRow } from "./_components/TracingBoard";
export const metadata = { title: "ফলো-আপ বোর্ড" };

export const dynamic = "force-dynamic";

// The defaulter assignment board (report BS-04, §13.6) — the loop the review called the
// product's missing core.
//
// A list of overdue children is the easy half and this system already had it. What it did not
// have was the half that makes the list matter: somebody's name against each row, a date they
// are going, and a record of what happened when they got there. Without those three, the same
// child appears on next month's list, the list stops being read, and the system is worked
// around rather than used.
export default async function TracingPage() {
  const { supabase, claims } = await requireAppRole("supervisor");
  await mfaGate(supabase, claims);

  const [{ data: tasks }, { data: staff }, { data: defaulters }] = await Promise.all([
    supabase
      .from("v_tracing_board")
      .select("id, status, child_id, child_code, full_name, area_name_bn, guardian_name, guardian_phone, address, assigned_to, assignee_name, due_by, doses_missed_at_open, days_overdue_at_open, outcome, outcome_note, is_late, created_at")
      .order("created_at", { ascending: false }),
    // Who can be sent. Field workers and supervisors both do visits; a store keeper does not.
    supabase
      .from("user_assignments")
      .select("user_id, role")
      .in("role", ["field_worker", "supervisor"])
      .is("valid_to", null),
    supabase.from("v_defaulters").select("child_id, has_open_task"),
  ]);

  const rows: TaskRow[] = (tasks ?? []).map((t) => ({
    id: t.id ?? "",
    status: t.status ?? "open",
    child_id: t.child_id ?? "",
    child_code: t.child_code ?? "",
    full_name: t.full_name ?? "",
    area: t.area_name_bn ?? "—",
    guardian_name: t.guardian_name ?? "—",
    guardian_phone: t.guardian_phone ?? "—",
    address: t.address ?? "—",
    assignee_id: t.assigned_to ?? null,
    assignee_name: t.assignee_name ?? null,
    due_by: t.due_by,
    doses_missed: Number(t.doses_missed_at_open ?? 0),
    days_overdue: Number(t.days_overdue_at_open ?? 0),
    outcome: t.outcome ?? null,
    outcome_note: t.outcome_note ?? null,
    is_late: Boolean(t.is_late),
  }));

  // De-duplicated: one person can hold two assignments (a posting and a secondment) and would
  // otherwise appear twice in the picker.
  const staffIds = [...new Set((staff ?? []).map((s) => s.user_id))];
  const { data: staffProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const assignees = (staffProfiles ?? [])
    .map((p) => ({ id: p.id, name: p.full_name ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name, "bn"));

  const open = rows.filter((r) => r.status === "open").length;
  const assigned = rows.filter((r) => r.status === "assigned").length;
  const late = rows.filter((r) => r.is_late).length;
  const closedThisRound = rows.filter((r) => r.status === "closed").length;

  // The number that says whether the board is being kept up to date at all: defaulters with no
  // task on them. If it is large the board is decorative.
  const untracked = (defaulters ?? []).filter((d) => !d.has_open_task).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ফলো-আপ বোর্ড"
        description="যেসব শিশুর টিকা নির্ধারিত সময়ের পরেও বাকি, তাদের প্রত্যেকের জন্য একজন কর্মী, একটি তারিখ, এবং দরজায় গিয়ে কী হলো তার হিসাব। এই তিনটি ছাড়া তালিকাটি শুধু একটি তালিকা।"
        actions={
          <>
            <RefreshBoardButton untracked={untracked} />
            <PrintButton label="রুট তালিকা ছাপুন" />
          </>
        }
      />

      <div className="print-only text-sm">
        <p>
          <strong>ফলো-আপ রুট তালিকা</strong> · মোট {toBn(rows.length)} টি কাজ ·{" "}
          {dateBn(new Date().toISOString())}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <StatCard
          label="অপেক্ষমাণ"
          value={toBn(open)}
          tone={open > 0 ? "warning" : "success"}
          hint="কেউ এখনো দায়িত্ব নেয়নি"
        />
        <StatCard label="বরাদ্দকৃত" value={toBn(assigned)} tone="primary" hint="কর্মী নির্ধারিত" />
        <StatCard
          label="সময় পেরিয়েছে"
          value={toBn(late)}
          tone={late > 0 ? "danger" : "success"}
          hint="নির্ধারিত তারিখের পরেও পরিদর্শন হয়নি"
        />
        <StatCard
          label="তালিকার বাইরে"
          value={toBn(untracked)}
          tone={untracked > 0 ? "danger" : "success"}
          hint="ডিফল্টার, অথচ কোনো ফলো-আপ কাজ নেই"
        />
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="বোর্ডে কোনো কাজ নেই"
          hint={
            untracked > 0
              ? `${untracked} জন শিশুর টিকা বাকি আছে কিন্তু কোনো ফলো-আপ কাজ তৈরি হয়নি। উপরের বোতাম দিয়ে তালিকা তৈরি করুন।`
              : "এই মুহূর্তে আপনার এলাকায় নির্ধারিত সময়ের বাইরে কোনো শিশু নেই।"
          }
        />
      ) : (
        <TracingBoard rows={rows} assignees={assignees} closedCount={closedThisRound} />
      )}
    </div>
  );
}
