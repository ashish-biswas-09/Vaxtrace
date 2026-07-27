import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/kit";
import { PlusIcon } from "@/components/icons";
import { CatalogTable, type VaccineRow } from "./_components/CatalogTable";

export const metadata = { title: "টিকা তালিকা" };

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
      <PageHeader
        title="টিকা তালিকা"
        description={`মোট ${toBn(rows.length)} টি টিকা${
          incomplete > 0 ? ` — ${toBn(incomplete)} টির ডোজ সূচি অসম্পূর্ণ` : ""
        }`}
        actions={
          <Button href="/admin/catalog/new" icon={<PlusIcon size={16} />}>
            নতুন টিকা
          </Button>
        }
      />

      <CatalogTable rows={rows} />
    </div>
  );
}
