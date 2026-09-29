"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import type { AppRole } from "@/lib/roles";
import { AdminNav, type NavCounts } from "./AdminNav";

// Desktop rail. Collapses to icons so an admin working in a wide table can reclaim 192px
// without losing wayfinding, and the choice survives navigation.
//
// The collapsed state lives on <html data-sidebar>, set before paint by the boot script and
// styled entirely in CSS. React holds none of it: reading localStorage into state on mount
// means either a setState inside an effect — a cascading render, and what the lint rule is
// actually complaining about — or an expanded rail that snaps shut after hydration. Toggling
// an attribute has neither problem and is less code.
//
// Rendered only at `lg` and up; below that the same nav lives in MobileDrawer.

function toggleRail() {
  const el = document.documentElement;
  const collapsing = el.dataset.sidebar !== "collapsed";
  if (collapsing) el.dataset.sidebar = "collapsed";
  else delete el.dataset.sidebar;
  try {
    localStorage.setItem("vt-sidebar", collapsing ? "collapsed" : "expanded");
  } catch {
    // Private mode: the rail still toggles for this session.
  }
}

export function Sidebar({
  counts,
  appRole,
  identity,
}: {
  counts: NavCounts;
  appRole: AppRole | null;
  identity: { code: string | null; role: string };
}) {
  // `[` toggles the rail. Ignored while the user is typing, or it would eat the bracket.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      toggleRail();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside className="vt-sidebar sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--surface)] lg:flex print:hidden">
      <Link
        href="/admin"
        className="vt-brand flex h-14 shrink-0 items-center gap-2.5 border-b border-[var(--border-subtle)] px-4"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] text-sm font-bold text-[var(--accent-fg)]"
        >
          V
        </span>
        <span className="vt-brand-text min-w-0">
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
            VaxTrace
          </span>
          <span className="block truncate text-[0.6875rem] text-[var(--text-muted)]">
            অ্যাডমিন প্যানেল
          </span>
        </span>
      </Link>

      <div className="flex-1 p-3">
        <AdminNav counts={counts} appRole={appRole} />
      </div>

      <div className="vt-rail-foot sticky bottom-0 flex items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface)] p-3">
        <span className="vt-identity min-w-0 flex-1">
          <span className="block truncate font-mono text-[0.6875rem] text-[var(--text-secondary)]">
            {identity.code ?? "—"}
          </span>
          <span className="block truncate text-[0.6875rem] text-[var(--text-muted)]">
            {identity.role}
          </span>
        </span>
        <button
          type="button"
          onClick={toggleRail}
          aria-label="সাইডবার সংকুচিত বা প্রসারিত করুন"
          title="সাইডবার ( [ )"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
        >
          <ChevronLeftIcon size={18} className="vt-rail-collapse" />
          <ChevronRightIcon size={18} className="vt-rail-expand" />
        </button>
      </div>
    </aside>
  );
}
