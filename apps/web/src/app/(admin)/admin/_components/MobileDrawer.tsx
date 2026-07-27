"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { AdminNav, type NavCounts } from "./AdminNav";

// The nav below `lg`. Previously a plain absolutely-positioned div: no focus trap, no Escape,
// and dismissal only through an invisible full-screen button. `<dialog showModal()>` gives all
// three from the platform — inert background, focus trap, Escape, and a real ::backdrop — so
// there is nothing to hand-roll and nothing to get wrong.
//
// The panel has to close on navigation, or it stays open over the page it just moved to. That
// is done by keying the inner component on the pathname — React discards the old instance,
// its `open` state and the <dialog> element with it — rather than by resetting state from an
// effect, which costs an extra render pass and is the cascading-renders lint rule's whole
// complaint.
export function MobileDrawer({ counts }: { counts: NavCounts }) {
  const pathname = usePathname();
  return <MobileDrawerPanel key={pathname} counts={counts} />;
}

function MobileDrawerPanel({ counts }: { counts: NavCounts }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function show() {
    ref.current?.showModal();
    setOpen(true);
  }

  function hide() {
    ref.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-expanded={open}
        aria-label="মেনু খুলুন"
        className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border border-[var(--border-default)] text-[var(--text-secondary)] lg:hidden"
      >
        <MenuIcon />
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-label="প্রধান মেনু"
        className="m-0 h-full max-h-none w-72 max-w-[85vw] bg-[var(--surface)] p-0 text-[var(--text-primary)] backdrop:bg-black/60"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
            <span>
              <span className="block text-sm font-semibold">VaxTrace</span>
              <span className="block text-[0.6875rem] text-[var(--text-muted)]">
                অ্যাডমিন প্যানেল
              </span>
            </span>
            <button
              type="button"
              onClick={hide}
              aria-label="মেনু বন্ধ করুন"
              className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <AdminNav counts={counts} onNavigate={hide} />
          </div>
        </div>
      </dialog>
    </>
  );
}
