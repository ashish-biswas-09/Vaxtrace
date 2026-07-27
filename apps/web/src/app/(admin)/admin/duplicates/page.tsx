import { mfaGate, requireAppRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/kit";
import { findDuplicateGroups, suggestWinner, type DupChild } from "./duplicates";
import { MergePanel } from "./_components/MergePanel";
export const metadata = { title: "সম্ভাব্য ডুপ্লিকেট" };

export const dynamic = "force-dynamic";

// The duplicate review queue (report BS-05, §16.2 shared screens).
//
// Duplicates are inevitable, not a defect: the registration form deliberately *warns* about a
// possible duplicate rather than blocking it, because twins share a surname, a date of birth
// and a phone number, and a worker who cannot register the second twin will register them as
// something else. That choice is only defensible if somebody reviews the warnings afterwards.
// This is that somebody's screen.
export default async function DuplicatesPage() {
  const { supabase, claims } = await requireAppRole("programme_manager");
  await mfaGate(supabase, claims);

  const [{ data: kids }, { data: doses }] = await Promise.all([
    supabase
      .from("children")
      .select("id, child_id, full_name, date_of_birth, guardian_id, birth_registration_no, created_at")
      .is("deleted_at", null)
      .is("merged_into_id", null),
    supabase.from("vaccination_records").select("child_id").is("voided_at", null),
  ]);

  const guardianIds = [...new Set((kids ?? []).map((k) => k.guardian_id))];
  const { data: guardians } = guardianIds.length
    ? await supabase.from("guardians").select("id, full_name, phone").in("id", guardianIds)
    : { data: [] as { id: string; full_name: string; phone: string }[] };
  const guardianById = new Map((guardians ?? []).map((g) => [g.id, g]));

  // The dose count decides which record should survive, so it is fetched rather than guessed.
  const doseCount = new Map<string, number>();
  for (const d of doses ?? []) doseCount.set(d.child_id, (doseCount.get(d.child_id) ?? 0) + 1);

  const children: DupChild[] = (kids ?? []).map((k) => {
    const g = guardianById.get(k.guardian_id);
    return {
      id: k.id,
      child_id: k.child_id,
      full_name: k.full_name,
      date_of_birth: k.date_of_birth,
      guardian_id: k.guardian_id,
      guardian_name: g?.full_name ?? "—",
      guardian_phone: g?.phone ?? "",
      created_at: k.created_at,
      birth_registration_no: k.birth_registration_no,
      doses: doseCount.get(k.id) ?? 0,
    };
  });

  const groups = findDuplicateGroups(children);
  const exact = groups.filter((g) => g.confidence === "exact").length;
  const affected = new Set(groups.flatMap((g) => g.children.map((c) => c.id))).size;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="সম্ভাব্য ডুপ্লিকেট"
        description="নিবন্ধনের সময় সিস্টেম সতর্ক করে, কিন্তু আটকায় না — যমজ শিশুদের নাম, জন্মতারিখ ও অভিভাবকের ফোন এক হয়, আর দ্বিতীয় যমজকে নিবন্ধন করতে না পারলে কর্মী তাকে অন্য কিছু বানিয়ে লিখবেন। সেই সিদ্ধান্ত তখনই ঠিক, যখন পরে কেউ সতর্কবার্তাগুলো যাচাই করে। এটি সেই পাতা।"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="সম্ভাব্য জোড়া"
          value={toBn(groups.length)}
          tone={groups.length > 0 ? "warning" : "success"}
        />
        <StatCard
          label="নিশ্চিত মিল"
          value={toBn(exact)}
          tone={exact > 0 ? "danger" : "success"}
          hint="জন্ম নিবন্ধন নম্বর অভিন্ন — এরা একই শিশু"
        />
        <StatCard label="জড়িত শিশু" value={toBn(affected)} hint="যাচাই করা প্রয়োজন" />
      </section>

      {groups.length === 0 ? (
        <EmptyState
          title="কোনো সম্ভাব্য ডুপ্লিকেট নেই"
          hint="নাম ও জন্মতারিখ, জন্ম নিবন্ধন নম্বর, কিংবা অভিভাবকের ফোন ও জন্মতারিখ — এই তিনটির কোনোটিতেই একাধিক শিশুর মিল পাওয়া যায়নি।"
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((g) => (
            <li key={g.key}>
              <MergePanel
                group={g}
                suggestedWinnerId={suggestWinner(g.children).id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
