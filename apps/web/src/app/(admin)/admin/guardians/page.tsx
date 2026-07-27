import { requireRole } from "@/lib/auth";
import { dateBn, toBn } from "@/lib/format";
import { RELATIONSHIP_LABEL_BN, hasUsablePhone, type GuardianRelationship } from "@/lib/guardians";
import { StatCard } from "@/components/ui/kit";
import { GuardiansTable, type GuardianRow } from "./_components/GuardiansTable";
export const metadata = { title: "অভিভাবক" };

export const dynamic = "force-dynamic";

// Guardians (BS-02). Before this, a guardian *was* a user account, so a child could not be
// registered for the overwhelming majority of families — the ones with no smartphone, no
// email and no reason to create a login. Splitting the domain record from the auth identity
// is what turns parent onboarding from a prerequisite into a growth loop.
//
// The two numbers worth reading on this screen are the ones that tell you the reminder system
// cannot do its job: guardians with no usable phone, and guardians who have not claimed an
// account. The first is a data-collection failure; the second is just the loop still running.
export default async function GuardiansPage() {
  const supabase = await requireRole("admin");

  const [{ data: guardians }, { data: children }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id, full_name, phone, email, relationship, user_id, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("children").select("guardian_id").is("deleted_at", null),
  ]);

  const childCount = new Map<string, number>();
  for (const c of children ?? []) {
    childCount.set(c.guardian_id, (childCount.get(c.guardian_id) ?? 0) + 1);
  }

  const rows: GuardianRow[] = (guardians ?? []).map((g) => ({
    id: g.id,
    full_name: g.full_name,
    phone: g.phone,
    email: g.email,
    relationship: RELATIONSHIP_LABEL_BN[g.relationship as GuardianRelationship] ?? g.relationship,
    claimed: g.user_id !== null,
    children: childCount.get(g.id) ?? 0,
    created_at: dateBn(g.created_at),
  }));

  const noPhone = rows.filter((r) => !hasUsablePhone(r.phone)).length;
  const unclaimed = rows.filter((r) => !r.claimed).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">অভিভাবক</h1>
        <p className="text-sm text-[var(--color-muted)]">
          অভিভাবক একটি রেকর্ড, অ্যাকাউন্ট নয় — স্মার্টফোন বা ইমেইল ছাড়াই শিশু নিবন্ধন করা যায়।
          অভিভাবক চাইলে পরে শিশু আইডি দিয়ে নিজের অ্যাকাউন্টে শিশুকে যুক্ত করতে পারেন।
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="মোট অভিভাবক" value={toBn(rows.length)} />
        <StatCard
          label="ব্যবহারযোগ্য নম্বর নেই"
          value={toBn(noPhone)}
          tone={noPhone > 0 ? "danger" : "success"}
          hint="এই পরিবারগুলো কোনো রিমাইন্ডার পাবে না"
        />
        <StatCard
          label="অ্যাকাউন্ট যুক্ত হয়নি"
          value={toBn(unclaimed)}
          tone="muted"
          hint="স্বাভাবিক — নিবন্ধনের জন্য অ্যাকাউন্ট প্রয়োজন নেই"
        />
      </section>

      {noPhone > 0 && (
        <p
          role="status"
          className="rounded-md border border-[var(--color-danger)] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {toBn(noPhone)} জন অভিভাবকের ব্যবহারযোগ্য ফোন নম্বর নেই। পুরনো তথ্য থেকে স্থানান্তরের
          সময় নম্বর পাওয়া যায়নি — মাঠপর্যায়ে সংগ্রহ করে হালনাগাদ করতে হবে।
        </p>
      )}

      <GuardiansTable rows={rows} />
    </div>
  );
}
