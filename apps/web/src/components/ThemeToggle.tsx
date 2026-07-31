"use client";

import { MoonIcon, SunIcon } from "@/components/icons";

// The blocking script in the root layout sets `data-theme` on <html> before paint, so the
// current theme is a fact about the DOM, not React state.
//
// Holding it in state was a hydration mismatch: there is no document on the server, so the
// initial value was always "dark", while the client's hydration render read the real attribute
// and got "light" for anyone who had chosen it — different icon, different aria-label, and
// React threw away the server tree for the whole layout. Rendering both icons and letting CSS
// pick from the same attribute the script already set makes the server and client markup
// identical by construction: no flash, no post-mount correction, no state.
export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("vt-theme", next);
    } catch {
      // Private mode / storage disabled: the toggle still works for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="থিম পরিবর্তন করুন"
      title="থিম পরিবর্তন করুন"
      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
    >
      <span className="hidden [[data-theme=dark]_&]:block">
        <SunIcon />
      </span>
      <span className="block [[data-theme=dark]_&]:hidden">
        <MoonIcon />
      </span>
    </button>
  );
}
