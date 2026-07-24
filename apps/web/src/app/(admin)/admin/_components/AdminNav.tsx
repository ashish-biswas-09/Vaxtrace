"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
