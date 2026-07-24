import { requireRole, getUserRole } from "@/lib/auth";
import { AdminNav } from "./_components/AdminNav";
import { ThemeToggle } from "./_components/ThemeToggle";
import { AccountMenu } from "./_components/AccountMenu";

// Gates the whole /admin subtree on the JWT `user_role` claim (UX layer; RLS is the real
// boundary). Admin is dark-first per the Figma; #admin-root is the token scope the ThemeToggle
// retargets to light. data-theme re-scopes colors for this subtree only, so Auth stays light.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await requireRole("admin");
  const [{ data: { user } }, role] = await Promise.all([
    supabase.auth.getUser(),
    getUserRole(supabase),
  ]);

  return (
    <div
      id="admin-root"
      data-theme="dark"
      className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]"
    >
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-[var(--color-border)] p-4 print:hidden">
        <div>
          <p className="text-lg font-semibold">VaxTrace</p>
          <p className="text-xs text-[var(--color-muted)]">অ্যাডমিন প্যানেল</p>
        </div>
        <AdminNav />
      </aside>
      <div className="flex flex-1 flex-col overflow-x-auto">
        <header className="flex items-center justify-end gap-3 border-b border-[var(--color-border)] px-8 py-3 print:hidden">
          <ThemeToggle />
          <AccountMenu email={user?.email ?? ""} role={role} />
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
