"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircleIcon, CloseIcon, InfoIcon, XCircleIcon } from "@/components/icons";

// Nothing in the admin panel confirmed a mutation. Server actions revalidated and the page
// re-rendered with the same layout, so saving a batch, changing a role and clicking a
// disabled button were indistinguishable from each other.
//
// The region is a live region, so the confirmation is announced and not merely painted.

export type ActionResult<T = void> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; field?: string };

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; message: string };

const ToastCtx = createContext<(tone: Tone, message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: Tone, message: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onClose={() => setToasts((x) => x.filter((y) => y.id !== t.id))} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const TONE = {
  success: { fg: "var(--success)", bg: "var(--success-bg)", Icon: CheckCircleIcon },
  error: { fg: "var(--danger)", bg: "var(--danger-bg)", Icon: XCircleIcon },
  info: { fg: "var(--text-secondary)", bg: "var(--surface-raised)", Icon: InfoIcon },
} as const;

function ToastRow({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { fg, bg, Icon } = TONE[toast.tone];
  return (
    <div
      className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-[var(--r-lg)] border px-4 py-3 text-sm shadow-[var(--shadow-2)]"
      style={{ background: bg, borderColor: `color-mix(in oklab, ${fg} 35%, transparent)` }}
    >
      <span style={{ color: fg }} className="mt-0.5 shrink-0">
        <Icon size={18} />
      </span>
      <p className="flex-1 text-[var(--text-primary)]">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="বন্ধ করুন"
        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

// Bridges a `useActionState` result into the toast region. Forms render this once and get a
// confirmation on every submit without threading a callback through the action.
export function ActionToast({ state }: { state: ActionResult | undefined | null }) {
  const toast = useToast();
  useEffect(() => {
    if (!state) return;
    toast(state.ok ? "success" : "error", state.message);
  }, [state, toast]);
  return null;
}
