"use client";

import { Button } from "@/components/ui/Button";

// PDF export via the browser's native print-to-PDF. No PDF library — window.print() is the
// platform primitive, and the print stylesheet in globals.css drops the sidebar, forces an
// ink-friendly page and keeps table headers repeating across pages (UX-09).
//
// Default label says what it does: it prints, and the print dialog is where a PDF is saved.
export function PrintButton({ label = "প্রিন্ট / PDF" }: { label?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
