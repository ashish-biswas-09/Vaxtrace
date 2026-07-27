"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

// Replaces window.confirm(). Three flows used it — promoting a user to admin, suspending an
// account, and enqueuing the reminder run — which meant a privilege escalation was gated by
// unthemed browser chrome in the wrong language, with no room to state the consequence and
// nowhere to record why.
//
// Built on <dialog>, so focus trap, Escape and the backdrop come from the platform.

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = "primary",
  requireReason = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  requireReason?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setReason("");
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-labelledby="confirm-title"
      className="w-[min(28rem,92vw)] rounded-[var(--r-xl)] border border-[var(--border-default)] bg-[var(--surface)] p-0 text-[var(--text-primary)] shadow-[var(--shadow-2)] backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 id="confirm-title" className="text-base font-semibold">
            {title}
          </h2>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">{body}</div>
        </div>

        {requireReason && (
          <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium text-[var(--text-secondary)]">
            কারণ
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="কেন এই পরিবর্তন?"
              className="h-10 rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)]"
            />
          </label>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            বাতিল
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={requireReason && reason.trim().length === 0}
            onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
