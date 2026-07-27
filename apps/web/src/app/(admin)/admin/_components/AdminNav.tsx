"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// Twenty-three destinations. A flat list of twenty-three is not navigation, it is a wall, and
// the audit's C4 finding (two competing analytics IAs) was the first symptom of one. They group
// by the question the reader arrived with:
//
//   পরিষেবা   — a named child or family in front of me
//   কর্মসূচি   — how is the programme doing, and where
//   সরবরাহ    — is there vaccine, is it cold, is it in date
//   প্রশাসন   — the reference data and the guard rails
//
// Order inside each group is by how often it is opened, not alphabetically.
const NAV: { heading: string; items: { href: string; label: string }[] }[] = [
  {
    heading: "পরিষেবা",
    items: [
      { href: "/admin/children", label: "শিশু" },
      { href: "/admin/guardians", label: "অভিভাবক" },
      { href: "/admin/tracing", label: "ফলো-আপ বোর্ড" },
      { href: "/admin/zero-dose", label: "শূন্য-ডোজ শিশু" },
      { href: "/admin/duplicates", label: "সম্ভাব্য ডুপ্লিকেট" },
    ],
  },
  {
    heading: "কর্মসূচি",
    items: [
      { href: "/admin/coverage", label: "এলাকাভিত্তিক কভারেজ" },
      { href: "/admin/sessions", label: "টিকাদান সেশন" },
      { href: "/admin/reports", label: "রিপোর্ট" },
      { href: "/admin/aefi", label: "টিকা-পরবর্তী ঘটনা" },
      { href: "/admin/data-quality", label: "তথ্যের মান" },
    ],
  },
  {
    heading: "সরবরাহ",
    items: [
      { href: "/admin/inventory", label: "টিকা মজুদ" },
      { href: "/admin/stock", label: "স্টক লেজার" },
      { href: "/admin/requisitions", label: "চাহিদাপত্র" },
      { href: "/admin/cold-chain", label: "কোল্ড চেইন" },
      { href: "/admin/catalog", label: "টিকা তালিকা" },
    ],
  },
  {
    heading: "প্রশাসন",
    items: [
      // Geography, service points and the denominator stay adjacent: they are the three things
      // a coverage number needs before it means anything, and they are managed together.
      { href: "/admin/locations", label: "প্রশাসনিক এলাকা" },
      { href: "/admin/facilities", label: "সেবা কেন্দ্র" },
      { href: "/admin/population", label: "জনসংখ্যার হিসাব" },
      { href: "/admin/users", label: "ব্যবহারকারী" },
      { href: "/admin/break-glass", label: "জরুরি প্রবেশাধিকার" },
      { href: "/admin/audit", label: "অডিট লগ" },
      { href: "/admin/notifications", label: "বিজ্ঞপ্তি" },
      { href: "/admin/settings", label: "সেটিংস" },
      { href: "/admin/help", label: "সহায়িকা" },
    ],
  },
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
          <div className="absolute left-0 z-20 mt-2 max-h-[75vh] w-60 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-lg">
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
      <NavLink href="/admin" label="ড্যাশবোর্ড" pathname={pathname} />
      {NAV.map((group) => (
        // A <ul> per group under its own heading, so a screen reader announces "পরিষেবা, list,
        // 5 items" instead of one flat list of twenty-three links.
        <section key={group.heading} className="mt-5">
          <h2 className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
            {group.heading}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink {...item} pathname={pathname} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  // /admin matches exactly; the rest match their subtree (e.g. /admin/inventory/[id]).
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-medium"
          : "text-[var(--color-muted)] hover:bg-[var(--color-fg)]/10 hover:text-[var(--color-fg)]"
      }`}
    >
      {label}
    </Link>
  );
}
