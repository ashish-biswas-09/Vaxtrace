import { requireRole, getUserRole } from "@/lib/auth";
import { AdminNav, MobileNav } from "./_components/AdminNav";
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
  // The admin's own immutable Admin ID, shown in the account menu so the identifier they
  // quote in a report is one click away rather than something they have to look up.
  const { data: myRole } = user
    ? await supabase
        .from("user_roles")
        .select("staff_code")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle()
    : { data: null };

  return (
    <div
      id="admin-root"
      data-theme="dark"
      className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]"
    >
      {/* Below `lg` the sidebar is removed from the flow entirely and the same nav renders
          inside the header as a disclosure. A fixed w-56 rail on a tablet ate a third of the
          viewport and pushed every table off-screen. */}
      {/* sticky + its own scroll: with twenty-three grouped destinations the rail is taller
          than a laptop viewport, and a nav that scrolls the page away from the table it is
          navigating is worse than no nav. */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-6 overflow-y-auto border-r border-[var(--color-border)] p-4 lg:flex print:hidden">
        <div>
          <p className="text-lg font-semibold">VaxTrace</p>
          <p className="text-xs text-[var(--color-muted)]">অ্যাডমিন প্যানেল</p>
        </div>
        <AdminNav />
      </aside>

      {/* min-w-0 is load-bearing: without it a flex child refuses to shrink below its content
          width, so the overflow-x-auto on wide tables never engages and the page itself
          scrolls sideways instead. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-8 print:hidden">
          <div className="flex items-center gap-3 lg:hidden">
            <MobileNav />
            <p className="font-semibold">VaxTrace</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <AccountMenu
              email={user?.email ?? ""}
              role={role}
              staffCode={myRole?.staff_code ?? null}
            />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
