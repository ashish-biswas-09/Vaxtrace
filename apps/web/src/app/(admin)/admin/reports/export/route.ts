import { requireRole } from "@/lib/auth";

// CSV export of the coverage report (TODO 2.12). A GET route handler is the native primitive
// for file download — Content-Disposition triggers the browser save dialog. requireRole
// redirects non-admins, so this can't leak the report to other roles.
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const supabase = await requireRole("admin");
  const { data } = await supabase
    .from("v_coverage")
    .select("code, name_en, name_bn, coverage_rate")
    .order("code");

  const header = ["code", "name_en", "name_bn", "coverage_percent"];
  const rows = (data ?? []).map((r) =>
    [
      r.code ?? "",
      r.name_en ?? "",
      r.name_bn ?? "",
      r.coverage_rate != null ? Math.round(r.coverage_rate * 100) : "",
    ]
      .map(csvCell)
      .join(","),
  );

  // Leading BOM so Excel reads the Bengali (UTF-8) names correctly.
  const csv = "﻿" + [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vaxtrace-coverage-report.csv"',
    },
  });
}
