"use client";

import Link from "next/link";
import { useState } from "react";
import { signOutAction } from "@/server/session";

const ROLE_BN: Record<string, string> = {
  admin: "অ্যাডমিন",
  worker: "স্বাস্থ্যকর্মী",
  parent: "অভিভাবক",
};

// Account control (audit UX-08): an avatar with the user's initial that opens name/role/logout,
// so the top-right glyph is no longer an ambiguous "অ".
export function AccountMenu({
  email,
  role,
  staffCode,
}: {
  email: string;
  role: string | null;
  staffCode: string | null;
}) {
  const [open, setOpen] = useState(false);
  const initial = (email.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="অ্যাকাউন্ট"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-medium text-[var(--color-primary-fg)]"
      >
        {initial}
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
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-60 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 shadow-lg"
          >
            <p className="truncate text-sm" title={email}>
              {email || "—"}
            </p>
            <p className="text-xs text-[var(--color-muted)]">{role ? (ROLE_BN[role] ?? role) : "—"}</p>
            {staffCode && (
              <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">{staffCode}</p>
            )}
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-border)]"
            >
              অ্যাকাউন্ট সেটিংস
            </Link>
            <form action={signOutAction} className="mt-2">
              <button
                type="submit"
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-left text-sm hover:bg-[var(--color-border)]"
              >
                লগ আউট
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
