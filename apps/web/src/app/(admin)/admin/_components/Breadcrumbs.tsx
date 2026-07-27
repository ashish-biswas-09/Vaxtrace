"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { NAV_GROUPS } from "./AdminNav";

// Route-derived breadcrumbs. Detail screens used to hand-write their own back-link — only
// /admin/children/[id] ever did, so the batch and vaccine detail pages had no way back at all
// except the browser button.
//
// The trail's last crumb is the record's own name, which the layout cannot know: it lives
// behind a dynamic segment the layout never receives. A detail page announces it by rendering
// <SetBreadcrumb label={child.full_name} />; the context is scoped to the admin shell.

const TailCtx = createContext<{
  tail: string | null;
  setTail: (v: string | null) => void;
}>({ tail: null, setTail: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [tail, setTail] = useState<string | null>(null);
  const value = useMemo(() => ({ tail, setTail }), [tail]);
  return <TailCtx.Provider value={value}>{children}</TailCtx.Provider>;
}

export function SetBreadcrumb({ label }: { label: string }) {
  const { setTail } = useContext(TailCtx);
  useEffect(() => {
    setTail(label);
    return () => setTail(null);
  }, [label, setTail]);
  return null;
}

const LEAF_LABEL: Record<string, string> = { new: "নতুন", export: "রপ্তানি" };

export function Breadcrumbs() {
  const pathname = usePathname();
  const { tail } = useContext(TailCtx);

  const crumbs = useMemo(() => {
    // Longest matching nav href wins, so /admin/children/[id] resolves to Children rather
    // than to the Dashboard's bare /admin.
    let group: string | null = null;
    let item: { href: string; label: string } | null = null;
    for (const g of NAV_GROUPS) {
      for (const i of g.items) {
        const match = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        if (match && (!item || i.href.length > item.href.length)) {
          group = g.heading;
          item = { href: i.href, label: i.label };
        }
      }
    }
    if (!item) return [{ label: "অ্যাডমিন", href: "/admin" as string | null }];

    const out: { label: string; href: string | null }[] = [];
    if (item.href !== "/admin" && group) out.push({ label: group, href: null });

    const rest = pathname.slice(item.href.length).split("/").filter(Boolean);
    out.push({ label: item.label, href: rest.length ? item.href : null });

    if (rest.length) {
      const leaf = rest[rest.length - 1];
      out.push({ label: LEAF_LABEL[leaf] ?? tail ?? "বিস্তারিত", href: null });
    }
    return out;
  }, [pathname, tail]);

  return (
    <nav aria-label="ব্রেডক্রাম্ব" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <ChevronRightIcon size={14} className="shrink-0 text-[var(--text-muted)]" />
            )}
            {c.href ? (
              <Link
                href={c.href}
                className="truncate text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {c.label}
              </Link>
            ) : (
              <span
                aria-current={i === crumbs.length - 1 ? "page" : undefined}
                className={
                  i === crumbs.length - 1
                    ? "truncate font-medium text-[var(--text-primary)]"
                    : "truncate text-[var(--text-muted)]"
                }
              >
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
