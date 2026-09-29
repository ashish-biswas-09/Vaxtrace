import { mfaGate, requireAppRole } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayIso } from "@/lib/format";

// CSV export of the coverage report (TODO 2.12). A GET route handler is the native primitive
// for file download — Content-Disposition triggers the browser save dialog.
//
// Route handlers do not render the admin layout, so the role and MFA gates are applied here
// explicitly (K-08). The read is the caller's RLS-scoped client: a supervisor exports their
// own area, not the country.
export async function GET() {
  const { supabase, claims } = await requireAppRole("supervisor");
  await mfaGate(supabase, claims);
  const { data } = await supabase
    .from("v_coverage")
    .select("code, name_en, name_bn, coverage_rate, done_count, due_count")
    .order("code");

  // Counts as well as the rate: a spreadsheet of bare percentages cannot be aggregated,
  // weighted or sanity-checked by whoever receives it.
  const csv = toCsv(
    ["code", "name_en", "name_bn", "doses_done", "doses_due", "coverage_percent"],
    (data ?? []).map((r) => [
      r.code,
      r.name_en,
      r.name_bn,
      r.done_count,
      r.due_count,
      r.coverage_rate != null ? Math.round(r.coverage_rate * 100) : "",
    ]),
  );

  return csvResponse(csv, `vaxtrace-coverage-${todayIso()}.csv`);
}
