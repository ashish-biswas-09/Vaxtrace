"use client";

import { useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";

type Theme = "dark" | "light";

// The blocking script in the root layout has already set `data-theme` on <html> before paint,
// so this only has to read it — no effect, no post-hydration flash, and the same toggle now
// governs auth, /account and the worker console rather than the admin subtree alone.
function current(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(current);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("vt-theme", next);
    } catch {
      // Private mode / storage disabled: the toggle still works for this session.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "লাইট মোডে যান" : "ডার্ক মোডে যান"}
      title={theme === "dark" ? "লাইট মোড" : "ডার্ক মোড"}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
