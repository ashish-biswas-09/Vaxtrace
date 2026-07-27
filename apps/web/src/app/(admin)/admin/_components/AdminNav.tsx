"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toBn } from "@/lib/format";
import {
  AefiIcon,
  BellIcon,
  BreakGlassIcon,
  CatalogIcon,
  ChildrenIcon,
  ColdChainIcon,
  CoverageIcon,
  DashboardIcon,
  DataQualityIcon,
  DuplicatesIcon,
  FacilitiesIcon,
  GuardiansIcon,
  HelpIcon,
  InventoryIcon,
  LocationsIcon,
  PopulationIcon,
  ReportsIcon,
  RequisitionsIcon,
  SessionsIcon,
  SettingsIcon,
  StockIcon,
  TracingIcon,
  UsersIcon,
  ZeroDoseIcon,
} from "@/components/icons";

// Twenty-three destinations. A flat list of twenty-three is not navigation, it is a wall, so
// they group by the question the reader arrived with:
//
//   পরিষেবা    — a named child or family in front of me
//   কর্মসূচি    — how is the programme doing, and where
//   সরবরাহ     — is there vaccine, is it cold, is it in date
//   রেফারেন্স  — the data a coverage number needs before it means anything
//   প্রশাসন    — the guard rails
//
// The fifth group is new. প্রশাসন previously held nine of twenty-four items — twice any other
// group — and mixed reference data an officer edits monthly with guard rails a security owner
// touches once a quarter. Order inside each group is by how often it is opened.
//
// Icons and counts are the other two additions. Twenty-three lines of Bengali text with no
// glyphs are scanned by reading every one; a count turns "check whether anything needs me"
// from a page visit into a glance.

export type NavCounts = {
  due: number;
  untraced: number;
  zeroDose: number;
  stockAlerts: number;
  coldChain: number;
  openAefi: number;
  failedNotifications: number;
};

type Item = {
  href: string;
  label: string;
  Icon: (p: { className?: string; size?: number }) => React.ReactElement;
  count?: keyof NavCounts;
  countLabel?: string;
};

export const NAV_GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "পরিষেবা",
    items: [
      { href: "/admin/children", label: "শিশু", Icon: ChildrenIcon, count: "due", countLabel: "টি দেয় ডোজ" },
      { href: "/admin/guardians", label: "অভিভাবক", Icon: GuardiansIcon },
      { href: "/admin/tracing", label: "ফলো-আপ বোর্ড", Icon: TracingIcon, count: "untraced", countLabel: "টি ফলো-আপ বরাদ্দ হয়নি" },
      { href: "/admin/zero-dose", label: "শূন্য-ডোজ শিশু", Icon: ZeroDoseIcon, count: "zeroDose", countLabel: "টি শূন্য-ডোজ শিশু" },
      { href: "/admin/duplicates", label: "সম্ভাব্য ডুপ্লিকেট", Icon: DuplicatesIcon },
    ],
  },
  {
    heading: "কর্মসূচি",
    items: [
      { href: "/admin/coverage", label: "এলাকাভিত্তিক কভারেজ", Icon: CoverageIcon },
      { href: "/admin/sessions", label: "টিকাদান সেশন", Icon: SessionsIcon },
      { href: "/admin/reports", label: "রিপোর্ট", Icon: ReportsIcon },
      { href: "/admin/aefi", label: "টিকা-পরবর্তী ঘটনা", Icon: AefiIcon, count: "openAefi", countLabel: "টি খোলা কেস" },
      { href: "/admin/data-quality", label: "তথ্যের মান", Icon: DataQualityIcon },
    ],
  },
  {
    heading: "সরবরাহ",
    items: [
      { href: "/admin/inventory", label: "টিকা মজুদ", Icon: InventoryIcon, count: "stockAlerts", countLabel: "টি ব্যাচে মনোযোগ প্রয়োজন" },
      { href: "/admin/stock", label: "স্টক লেজার", Icon: StockIcon },
      { href: "/admin/requisitions", label: "চাহিদাপত্র", Icon: RequisitionsIcon },
      { href: "/admin/cold-chain", label: "কোল্ড চেইন", Icon: ColdChainIcon, count: "coldChain", countLabel: "টি সতর্কতা" },
      { href: "/admin/catalog", label: "টিকা তালিকা", Icon: CatalogIcon },
    ],
  },
  {
    heading: "রেফারেন্স",
    items: [
      // Geography, service points and the denominator stay adjacent: they are the three things
      // a coverage number needs before it means anything, and they are managed together.
      { href: "/admin/locations", label: "প্রশাসনিক এলাকা", Icon: LocationsIcon },
      { href: "/admin/facilities", label: "সেবা কেন্দ্র", Icon: FacilitiesIcon },
      { href: "/admin/population", label: "জনসংখ্যার হিসাব", Icon: PopulationIcon },
      { href: "/admin/notifications", label: "বিজ্ঞপ্তি", Icon: BellIcon, count: "failedNotifications", countLabel: "টি ব্যর্থ বিজ্ঞপ্তি" },
    ],
  },
  {
    heading: "প্রশাসন",
    items: [
      { href: "/admin/users", label: "ব্যবহারকারী", Icon: UsersIcon },
      { href: "/admin/break-glass", label: "জরুরি প্রবেশাধিকার", Icon: BreakGlassIcon },
      { href: "/admin/settings", label: "সেটিংস", Icon: SettingsIcon },
      { href: "/admin/help", label: "সহায়িকা", Icon: HelpIcon },
    ],
  },
];

// /admin matches exactly; the rest match their subtree (e.g. /admin/inventory/[id]).
export function isActive(href: string, pathname: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

// The collapsed rail is a CSS state driven by `<html data-sidebar>`, not a prop: see
// Sidebar.tsx. Every element that differs between the two widths carries a `vt-` class and
// globals.css decides which is shown, so this component renders one tree either way.
export function AdminNav({
  counts,
  onNavigate,
}: {
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="প্রধান মেনু">
      <NavLink
        item={{ href: "/admin", label: "ড্যাশবোর্ড", Icon: DashboardIcon }}
        counts={counts}
        pathname={pathname}
        onNavigate={onNavigate}
      />

      {NAV_GROUPS.map((group) => (
        // A <ul> per group under its own heading, so a screen reader announces "পরিষেবা, list,
        // 5 items" instead of one flat list of twenty-three links.
        <section key={group.heading} className="mt-4">
          <hr className="vt-nav-divider mx-2 mb-1 border-[var(--border-subtle)]" />
          <h2 className="vt-nav-heading px-3 pb-1 text-[0.6875rem] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
            {group.heading}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  counts={counts}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function NavLink({
  item,
  counts,
  pathname,
  onNavigate,
}: {
  item: Item;
  counts: NavCounts;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { href, label, Icon, count, countLabel } = item;
  const active = isActive(href, pathname);
  const n = count ? counts[count] : 0;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`vt-nav-link relative flex h-10 items-center gap-3 rounded-[var(--r-md)] px-3 text-sm transition-colors duration-[var(--dur-fast)] ${
        active
          ? // Tint plus a rail, not a solid accent fill: solid accent is the primary CTA, and
            // twenty-three of them competed with the real action on every page.
            "bg-[var(--accent-bg)] font-medium text-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-[var(--accent)]"
        />
      )}
      <Icon />
      <span className="vt-nav-label flex-1 truncate">{label}</span>
      {n > 0 && (
        <>
          <span
            aria-hidden="true"
            className="vt-nav-count rounded-full bg-[var(--warning-bg)] px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-[var(--warning)]"
          >
            {toBn(n)}
          </span>
          {/* In the rail the number has nowhere to go, so it becomes a dot — the badge still
              says "something here needs you", which is all it can say at 64px. */}
          <span
            aria-hidden="true"
            className="vt-nav-dot absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--warning)]"
          />
          <span className="sr-only">
            — {toBn(n)} {countLabel}
          </span>
        </>
      )}
    </Link>
  );
}
