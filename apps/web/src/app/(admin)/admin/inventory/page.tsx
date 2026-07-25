import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { batchStatus } from "./status";
import { InventoryTable, type BatchRow } from "./_components/InventoryTable";

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

  const rows: BatchRow[] = (batches ?? []).map((b) => {
    const status = batchStatus(b.stock_quantity, b.expiry_date);
    return {
      id: b.id,
      vaccine_name: vaccineById.get(b.vaccine_id)?.name_bn ?? "—",
      batch_number: b.batch_number,
      stock_quantity: b.stock_quantity,
      expiry_date: b.expiry_date,
      tone: status.tone,
      label: status.label,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">টিকা মজুদ</h1>
          <p className="text-sm text-[var(--color-muted)]">
            মোট {toBn(rows.length)} টি ব্যাচ — মেয়াদ অনুসারে সাজানো
          </p>
        </div>
        <Link
          href="/admin/inventory/new"
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
        >
          নতুন ব্যাচ
        </Link>
      </header>
      <InventoryTable rows={rows} />
    </div>
  );
}
