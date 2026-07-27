import Link from "next/link";
import { Suspense } from "react";
import { BellIcon } from "@/components/icons";
import { toBn } from "@/lib/format";
import { AccountMenu } from "@/components/AccountMenu";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { DateScope } from "./DateScope";
import { MobileDrawer } from "./MobileDrawer";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { NavCounts } from "./AdminNav";

// The header used to hold a theme toggle and an avatar and nothing else — no title, no way
// back, no search, no indication that anything needed attention. Everything an admin needs
// regardless of which screen they are on lives here now.

export function Topbar({
  counts,
  user,
}: {
  counts: NavCounts;
  user: { email: string; role: string | null; staffCode: string | null };
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--canvas)]/85 px-4 backdrop-blur sm:px-6 print:hidden">
      <MobileDrawer counts={counts} />

      <div className="hidden min-w-0 flex-1 md:block">
        <Breadcrumbs />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
        <CommandPalette />
        {/* useSearchParams needs a boundary or the whole route opts out of static rendering. */}
        <Suspense fallback={null}>
          <DateScope />
        </Suspense>

        <Link
          href="/admin/notifications"
          aria-label={
            counts.failedNotifications > 0
              ? `বিজ্ঞপ্তি — ${toBn(counts.failedNotifications)}টি ব্যর্থ`
              : "বিজ্ঞপ্তি"
          }
          className="relative flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
        >
          <BellIcon size={18} />
          {counts.failedNotifications > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[0.625rem] font-medium text-white tabular-nums"
            >
              {toBn(counts.failedNotifications)}
            </span>
          )}
        </Link>

        <ThemeToggle />
        <AccountMenu email={user.email} role={user.role} staffCode={user.staffCode} />
      </div>
    </header>
  );
}
