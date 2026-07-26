"use client";

// PDF export via the browser's native print-to-PDF. No PDF library — window.print() is the
// platform primitive, and the print stylesheet in globals.css drops the sidebar, forces an
// ink-friendly page and keeps table headers repeating across pages (UX-09).
//
// Shared, because the route list, the session tally and the coverage report all print, and
// three copies of a four-line button is how the labels drift apart.
export function PrintButton({ label = "PDF রপ্তানি" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
    >
      {label}
    </button>
  );
}
