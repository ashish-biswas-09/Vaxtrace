import { requireRole } from "@/lib/auth";
import { AdminNav } from "./_components/AdminNav";
import { signOutAction } from "./_actions";

// Gates the whole /admin subtree on the JWT `user_role` claim (UX layer; RLS is the real
// boundary). Admin is dark-first per the Figma admin screens (TODO 2.10) — data-theme
// re-scopes the color tokens for this subtree only, so Auth stays light.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await requireRole("admin");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div
      data-theme="dark"
      className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]"
    >
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-[var(--color-border)] p-4">
        <div>
          <p className="text-lg font-semibold">VaxTrace</p>
          <p className="text-xs text-[var(--color-muted)]">অ্যাডমিন প্যানেল</p>
        </div>
        <AdminNav />
        <form action={signOutAction} className="mt-auto flex flex-col gap-2">
          <p className="truncate text-xs text-[var(--color-muted)]" title={user?.email ?? ""}>
            {user?.email}
          </p>
          <button
            type="submit"
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)]"
          >
            লগ আউট
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
