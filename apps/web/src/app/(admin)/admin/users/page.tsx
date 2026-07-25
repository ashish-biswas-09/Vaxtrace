import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { UsersTable, type UserRow } from "./_components/UsersTable";
import { InviteUser } from "./_components/InviteUser";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await requireRole("admin");
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, contact, status").order("full_name"),
    supabase.from("user_roles").select("user_id, role, staff_code"),
  ]);

  const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r]));

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
    };
  });

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
      <UsersTable rows={rows} />
    </div>
  );
}
