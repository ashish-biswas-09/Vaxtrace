"use client";

import { useEffect, useId, useRef } from "react";
import { CloseIcon } from "@/components/icons";

// A form in a native modal <dialog>, opened on mount. It replaces the panels that rendered
// below a whole table — 556px from the button on desktop, 2,875px on a phone, with focus left
// behind (K-18). showModal() brings the focus move, the focus trap, Escape and the inert
// background with it.
//
// Mount it when a row is chosen and unmount it on close, keyed by the row: a new row gets a new
// form, never the previous row's values (K-02).
export function FormDialog({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el || el.open) return;
    el.showModal();
    // showModal() focuses the first focusable element — the close button — because React
    // never writes an `autofocus` attribute. The first field is what the user came for.
    el.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea",
    )?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto max-h-[90vh] w-[min(40rem,94vw)] overflow-y-auto rounded-[var(--r-xl)] border border-[var(--border-default)] bg-[var(--surface)] p-5 text-[var(--text-primary)] shadow-[var(--shadow-2)] backdrop:bg-black/60"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="বন্ধ করুন"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
        >
          <CloseIcon size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
