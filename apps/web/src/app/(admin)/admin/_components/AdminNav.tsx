"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin", label: "ড্যাশবোর্ড" },
  { href: "/admin/children", label: "শিশু" },
  { href: "/admin/inventory", label: "টিকা মজুদ" },
  { href: "/admin/catalog", label: "টিকা তালিকা" },
  { href: "/admin/reports", label: "রিপোর্ট" },
  { href: "/admin/users", label: "ব্যবহারকারী" },
  { href: "/admin/audit", label: "অডিট লগ" },
  { href: "/admin/notifications", label: "বিজ্ঞপ্তি" },
  { href: "/admin/settings", label: "সেটিংস" },
];

// Below `lg` the sidebar is gone, so the same nav lives behind a button in the header.
//
// The panel has to close on navigation, or it stays open over the page it just moved to.
// That is done by keying the inner component on the pathname — React discards the old
// instance and its `open` state — rather than by resetting state from an effect, which
// costs an extra render pass and is the "cascading renders" lint rule's whole complaint.
export function MobileNav() {
  const pathname = usePathname();
  return <MobileNavPanel key={pathname} />;
}

function MobileNavPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="মেনু"
        className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
      >
        ☰
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute left-0 z-20 mt-2 w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-lg">
            <AdminNav />
          </div>
        </>
      )}
    </div>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label }) => {
        // /admin matches exactly; the rest match their subtree (e.g. /admin/inventory/[id]).
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm ${
              active
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-border)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
