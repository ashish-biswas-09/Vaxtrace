import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { toBn, dateBn } from "@/lib/format";
import { StatusBadge } from "../../_components/ui";
import { batchStatus } from "../status";
import { BatchEditForm, StockAdjustForm } from "./_components/BatchForms";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireRole("admin");

  const { data: batch } = await supabase
    .from("inventories")
    .select("id, vaccine_id, batch_number, stock_quantity, expiry_date")
    .eq("id", id)
    .single();
  if (!batch) notFound();

  const { data: vaccine } = await supabase
    .from("vaccines")
    .select("name_bn, code")
    .eq("id", batch.vaccine_id)
    .single();

  const status = batchStatus(batch.stock_quantity, batch.expiry_date);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/admin/inventory" className="text-sm text-[var(--color-muted)] hover:underline">
          ← টিকা মজুদ
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{vaccine?.name_bn ?? "ব্যাচ"}</h1>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          বর্তমান মজুদ {toBn(batch.stock_quantity)} — মেয়াদ {dateBn(batch.expiry_date)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--color-border)] p-5">
          <h2 className="mb-4 text-lg font-medium">ব্যাচ সম্পাদনা</h2>
          <BatchEditForm
            id={batch.id}
            batchNumber={batch.batch_number}
            expiryDate={batch.expiry_date}
            stockQuantity={batch.stock_quantity}
          />
        </section>
        <section className="rounded-xl border border-[var(--color-border)] p-5">
          <h2 className="mb-4 text-lg font-medium">দ্রুত মজুদ সমন্বয়</h2>
          <StockAdjustForm id={batch.id} />
        </section>
      </div>
    </div>
  );
}
