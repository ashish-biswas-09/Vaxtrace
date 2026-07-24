import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { StatusBadge } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await requireRole("admin");
  const { data: vaccines } = await supabase
    .from("vaccines")
    .select("id, code, name_bn, name_en, total_doses, is_active")
    .order("code");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">টিকা তালিকা</h1>
          <p className="text-sm text-[var(--color-muted)]">
            মোট {toBn((vaccines ?? []).length)} টি টিকা
          </p>
        </div>
        <Link
          href="/admin/catalog/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
        >
          নতুন টিকা
        </Link>
      </header>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">কোড</th>
              <th className="px-4 py-3 font-medium">নাম</th>
              <th className="px-4 py-3 font-medium">ডোজ</th>
              <th className="px-4 py-3 font-medium">অবস্থা</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(vaccines ?? []).map((v) => (
              <tr key={v.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 font-mono text-xs">{v.code}</td>
                <td className="px-4 py-3">
                  {v.name_bn}
                  <span className="ml-2 text-xs text-[var(--color-muted)]">{v.name_en}</span>
                </td>
                <td className="px-4 py-3">{toBn(v.total_doses)}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={v.is_active ? "success" : "muted"}>
                    {v.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/catalog/${v.id}`}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    সম্পাদনা
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
