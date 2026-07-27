"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { toBn } from "@/lib/format";
import { searchChildrenAction, type ChildHit } from "../_actions";
import { NAV_GROUPS } from "./AdminNav";

// ⌘K / Ctrl+K. Two jobs: reach any destination without the sidebar, and reach a child by ID
// or name from anywhere — previously only possible by navigating to the Children list first
// and searching there, which is the single most common thing an admin does with an ID read
// off a card or over the phone.

type Entry = { label: string; sub?: string; href: string };

const DESTINATIONS: Entry[] = NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ label: i.label, sub: g.heading, href: i.href })),
);

const ACTIONS: Entry[] = [
  { label: "নতুন শিশু নিবন্ধন", sub: "দ্রুত কাজ", href: "/admin/children/new" },
  { label: "নতুন ব্যাচ যোগ", sub: "দ্রুত কাজ", href: "/admin/inventory/new" },
  { label: "নতুন টিকা যোগ", sub: "দ্রুত কাজ", href: "/admin/catalog/new" },
  { label: "রিপোর্ট রপ্তানি (CSV)", sub: "দ্রুত কাজ", href: "/admin/reports" },
];

export function CommandPalette() {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  // Results are stored with the query they answer. Clearing them when the box empties would
  // be a setState in an effect body — a cascading render — and matching on the query also
  // fixes the staler bug it would have papered over: a slow response landing under a query
  // the user has already changed.
  const [result, setResult] = useState<{ q: string; rows: ChildHit[] }>({ q: "", rows: [] });
  const [cursor, setCursor] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced so a five-character ID is one round trip, not five.
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () =>
        setResult({ q: needle, rows: await searchChildrenAction(needle) }),
      );
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function open() {
    setQ("");
    setResult({ q: "", rows: [] });
    setCursor(0);
    ref.current?.showModal();
    // showModal focuses the dialog itself; the input is what the user meant.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function close() {
    ref.current?.close();
  }

  const trimmed = q.trim();
  const needle = trimmed.toLowerCase();
  const nav = [...DESTINATIONS, ...ACTIONS].filter((e) =>
    needle ? e.label.toLowerCase().includes(needle) : true,
  );
  const hits = trimmed.length >= 2 && result.q === trimmed ? result.rows : [];
  const childEntries: Entry[] = hits.map((h) => ({
    label: h.full_name,
    sub: toBn(h.child_id),
    href: `/admin/children/${h.id}`,
  }));
  const all = [...childEntries, ...nav];
  const active = all[Math.min(cursor, all.length - 1)];

  function go(href: string) {
    close();
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex h-9 items-center gap-2 rounded-[var(--r-md)] border border-[var(--border-default)] px-3 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-raised)] md:w-64"
      >
        <SearchIcon size={16} />
        <span className="hidden flex-1 text-left md:block">খুঁজুন…</span>
        <kbd className="hidden rounded border border-[var(--border-default)] px-1 font-sans text-[0.6875rem] md:block">
          ⌘K
        </kbd>
      </button>

      <dialog
        ref={ref}
        aria-label="দ্রুত অনুসন্ধান"
        className="w-[min(36rem,92vw)] rounded-[var(--r-xl)] border border-[var(--border-default)] bg-[var(--surface)] p-0 text-[var(--text-primary)] shadow-[var(--shadow-2)] backdrop:bg-black/60"
        onClose={() => setQ("")}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4">
          <SearchIcon size={18} className="text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, all.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && active) {
                e.preventDefault();
                go(active.href);
              }
            }}
            placeholder="শিশুর নাম বা আইডি, অথবা কোনো পাতা…"
            aria-label="শিশুর নাম বা আইডি, অথবা কোনো পাতা"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
          {pending && <span className="text-xs text-[var(--text-muted)]">খুঁজছে…</span>}
        </div>

        <ul className="max-h-80 overflow-y-auto p-2">
          {all.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              কিছু পাওয়া যায়নি।
            </li>
          )}
          {all.map((e, i) => (
            <li key={`${e.href}-${e.label}-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(e.href)}
                className={`flex w-full items-center justify-between gap-3 rounded-[var(--r-md)] px-3 py-2 text-left text-sm ${
                  i === Math.min(cursor, all.length - 1)
                    ? "bg-[var(--accent-bg)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="truncate">{e.label}</span>
                {e.sub && (
                  <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
                    {e.sub}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
