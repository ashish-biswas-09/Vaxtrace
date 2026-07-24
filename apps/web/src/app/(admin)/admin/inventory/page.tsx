import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { toBn, dateBn } from "@/lib/format";
import { StatusBadge } from "../_components/ui";
import { batchStatus } from "./status";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await requireRole("admin");

  const [{ data: batches }, { data: vaccines }] = await Promise.all([
    supabase
      .from("inventories")
      .select("id, vaccine_id, batch_number, stock_quantity, expiry_date")
      .order("expiry_date", { ascending: true }),
    supabase.from("vaccines").select("id, name_bn, code"),
  ]);

  const vaccineById = new Map((vaccines ?? []).map((v) => [v.id, v]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">টিকা মজুদ</h1>
        <p className="text-sm text-[var(--color-muted)]">
          মোট {toBn((batches ?? []).length)} টি ব্যাচ — মেয়াদ অনুসারে সাজানো
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">টিকা</th>
              <th className="px-4 py-3 font-medium">ব্যাচ</th>
              <th className="px-4 py-3 font-medium">মজুদ</th>
              <th className="px-4 py-3 font-medium">মেয়াদ</th>
              <th className="px-4 py-3 font-medium">অবস্থা</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(batches ?? []).map((b) => {
              const v = vaccineById.get(b.vaccine_id);
              const status = batchStatus(b.stock_quantity, b.expiry_date);
              return (
                <tr key={b.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">{v?.name_bn ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.batch_number}</td>
                  <td className="px-4 py-3">{toBn(b.stock_quantity)}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{dateBn(b.expiry_date)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/inventory/${b.id}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      সম্পাদনা
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(batches ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  কোনো ব্যাচ নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
