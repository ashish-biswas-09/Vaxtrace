import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { UsersTable, type UserRow } from "./_components/UsersTable";
import { InviteUser } from "./_components/InviteUser";
export const metadata = { title: "ব্যবহারকারী" };

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await requireRole("admin");
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: profiles }, { data: roles }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, contact, status").order("full_name"),
    supabase.from("user_roles").select("user_id, role, staff_code"),
    // Live postings only. `valid_to is null or >= today` is the same predicate auth_scopes()
    // applies, so the count on screen is the number of scopes actually granting access.
    supabase
      .from("user_assignments")
      .select("user_id, valid_from, valid_to")
      .lte("valid_from", today)
      .or(`valid_to.is.null,valid_to.gte.${today}`),
  ]);

  const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r]));
  const assignmentCount = new Map<string, number>();
  for (const a of assignments ?? []) {
    assignmentCount.set(a.user_id, (assignmentCount.get(a.user_id) ?? 0) + 1);
  }

  const rows: UserRow[] = (profiles ?? []).map((p) => {
    const r = roleByUser.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      contact: p.contact,
      role: r?.role ?? "parent",
      status: p.status,
      staff_code: r?.staff_code ?? null,
      is_self: p.id === me?.id,
      assignment_count: assignmentCount.get(p.id) ?? 0,
    };
  });

  const unassigned = rows.filter((r) => r.role !== "parent" && r.assignment_count === 0).length;

  const count = (role: string) => rows.filter((r) => r.role === role).length;
  const inactive = rows.filter((r) => r.status !== "active").length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ব্যবহারকারী ব্যবস্থাপনা</h1>
          <p className="text-sm text-[var(--color-muted)]">
            মোট {toBn(rows.length)} জন — {toBn(count("admin"))} অ্যাডমিন, {toBn(count("worker"))}{" "}
            স্বাস্থ্যকর্মী, {toBn(count("parent"))} অভিভাবক
            {inactive > 0 && ` · ${toBn(inactive)} জন সক্রিয় নয়`}। প্রতিটি ভূমিকার জন্য একটি
            অপরিবর্তনীয় আইডি স্বয়ংক্রিয়ভাবে তৈরি হয়।
          </p>
        </div>
        <InviteUser />
      </header>

      {unassigned > 0 && (
        // Not a warning for its own sake: without a posting every scoped policy returns an
        // empty set, so the account signs in successfully and then appears to have lost all
        // its data. Naming it here is cheaper than debugging it later.
        <p
          role="status"
          className="rounded-md border border-[var(--color-warning)] px-4 py-3 text-sm text-[var(--color-warning)]"
        >
          {toBn(unassigned)} জন কর্মীর কোনো দায়িত্ব বরাদ্দ নেই। দায়িত্ব ছাড়া তাঁরা কোনো শিশুর
          তথ্য দেখতে পাবেন না — নাম-এ ক্লিক করে এলাকা বরাদ্দ করুন।
        </p>
      )}

      <UsersTable rows={rows} />
    </div>
  );
}
