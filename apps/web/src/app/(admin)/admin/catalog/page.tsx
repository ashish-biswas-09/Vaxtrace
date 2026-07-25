import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { CatalogTable, type VaccineRow } from "./_components/CatalogTable";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await requireRole("admin");

  const [{ data: vaccines }, { data: doses }] = await Promise.all([
    supabase.from("vaccines").select("id, code, name_bn, name_en, total_doses, is_active").order("code"),
    supabase.from("vaccine_doses").select("vaccine_id"),
  ]);

  const definedByVaccine = new Map<string, number>();
  for (const d of doses ?? []) {
    definedByVaccine.set(d.vaccine_id, (definedByVaccine.get(d.vaccine_id) ?? 0) + 1);
  }

  const rows: VaccineRow[] = (vaccines ?? []).map((v) => ({
    ...v,
    doses_defined: definedByVaccine.get(v.id) ?? 0,
  }));

  const incomplete = rows.filter((v) => v.doses_defined !== v.total_doses).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">টিকা তালিকা</h1>
          <p className="text-sm text-[var(--color-muted)]">
            মোট {toBn(rows.length)} টি টিকা
            {incomplete > 0 && ` — ${toBn(incomplete)} টির ডোজ সূচি অসম্পূর্ণ`}
          </p>
        </div>
        <Link
          href="/admin/catalog/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
        >
          নতুন টিকা
        </Link>
      </header>

      <CatalogTable rows={rows} />
    </div>
  );
}
