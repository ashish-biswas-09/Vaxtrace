// CSV serialisation shared by every export route. Extracted from the coverage report when
// the audit export needed the same escaping — one implementation means one place for the
// quoting rule and the Excel BOM to be right.

export function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Leading BOM so Excel reads the Bengali (UTF-8) columns instead of mojibake.
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
