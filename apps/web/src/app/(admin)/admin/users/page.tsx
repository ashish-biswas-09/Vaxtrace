import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { RoleSelect } from "./_components/RoleSelect";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await requireRole("admin");
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, contact").order("full_name"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">ব্যবহারকারী ব্যবস্থাপনা</h1>
        <p className="text-sm text-[var(--color-muted)]">
          মোট {toBn((profiles ?? []).length)} জন — ভূমিকা পরিবর্তন করতে তালিকা থেকে নির্বাচন করুন
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">নাম</th>
              <th className="px-4 py-3 font-medium">যোগাযোগ</th>
              <th className="px-4 py-3 font-medium">ভূমিকা</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <tr key={p.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3">
                  {p.full_name}
                  {p.id === me?.id && (
                    <span className="ml-2 text-xs text-[var(--color-muted)]">(আপনি)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-muted)]">{p.contact ?? "—"}</td>
                <td className="px-4 py-3">
                  <RoleSelect
                    userId={p.id}
                    currentRole={roleByUser.get(p.id) ?? "parent"}
                    disabled={p.id === me?.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
