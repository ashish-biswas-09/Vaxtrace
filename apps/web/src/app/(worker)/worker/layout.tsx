import Link from "next/link";
import { appRoleAtLeast, getAppRole, getUserRole, requireRole } from "@/lib/auth";
import { AccountMenu } from "@/components/AccountMenu";

// Worker shell. Deliberately lighter than the admin one: a worker uses this on a phone or a
// tablet at a clinic, so navigation is a horizontal bar rather than a fixed sidebar.
export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await requireRole("worker");
  const [
    {
      data: { user },
    },
    role,
    appRole,
  ] = await Promise.all([supabase.auth.getUser(), getUserRole(supabase), getAppRole(supabase)]);

  const { data: myRole } = user
    ? await supabase
        .from("user_roles")
        .select("staff_code")
        .eq("user_id", user.id)
        .eq("role", "worker")
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-semibold">VaxTrace</p>
            <p className="text-xs text-[var(--color-muted)]">স্বাস্থ্যকর্মী কনসোল</p>
          </div>
          <nav className="flex gap-1">
            <Link
              href="/worker"
              className="rounded-md px-3 py-2 text-sm hover:bg-[var(--color-border)]"
            >
              হোম
            </Link>
            <Link
              href="/worker/children/new"
              className="rounded-md px-3 py-2 text-sm hover:bg-[var(--color-border)]"
            >
              শিশু নিবন্ধন
            </Link>
            {/* A supervisor's programme screens (coverage, sessions, AEFI, data quality) live
                in /admin, scoped to their own area. */}
            {appRoleAtLeast(appRole, "supervisor") && (
              <Link
                href="/admin/coverage"
                className="rounded-md px-3 py-2 text-sm hover:bg-[var(--color-border)]"
              >
                কর্মসূচি
              </Link>
            )}
          </nav>
        </div>
        <AccountMenu
          email={user?.email ?? ""}
          role={role}
          staffCode={myRole?.staff_code ?? null}
        />
      </header>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
