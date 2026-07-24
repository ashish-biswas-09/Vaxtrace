"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

// Flips the admin subtree between dark and light by retargeting the `data-theme` token scope
// on #admin-root (audit UX-08 — the toggle was designed but never built). Persisted so the
// choice survives navigation. Admin defaults dark per the Figma.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("admin-theme") as Theme | null) ?? "dark";
    apply(saved);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync of persisted pref on mount
    setTheme(saved);
  }, []);

  function apply(t: Theme) {
    document.getElementById("admin-root")?.setAttribute("data-theme", t);
  }

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    apply(next);
    localStorage.setItem("admin-theme", next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "লাইট মোডে যান" : "ডার্ক মোডে যান"}
      title={theme === "dark" ? "লাইট মোড" : "ডার্ক মোড"}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] hover:bg-[var(--color-border)]"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
