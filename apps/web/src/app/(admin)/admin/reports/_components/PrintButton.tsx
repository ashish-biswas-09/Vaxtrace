"use client";

// PDF export via the browser's native print-to-PDF (audit C4 wants PDF alongside CSV).
// No PDF library — window.print() is the platform primitive; the print stylesheet in the
// layout drops the sidebar so the report prints clean.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
    >
      PDF রপ্তানি
    </button>
  );
}
