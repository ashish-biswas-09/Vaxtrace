import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { NewBatchForm } from "./_components/NewBatchForm";
export const metadata = { title: "নতুন ব্যাচ" };

export const dynamic = "force-dynamic";

export default async function NewBatchPage() {
  const supabase = await requireRole("admin");
  // Only active vaccines: booking stock against a deactivated one would create inventory no
  // child's schedule can ever consume.
  const { data: vaccines } = await supabase
    .from("vaccines")
    .select("id, name_bn")
    .eq("is_active", true)
    .order("code");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/inventory" className="text-sm text-[var(--color-muted)] hover:underline">
          ← টিকা মজুদ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">নতুন ব্যাচ</h1>
        <p className="text-sm text-[var(--color-muted)]">নতুন সরবরাহ মজুদে যোগ করুন</p>
      </div>
      <NewBatchForm vaccines={vaccines ?? []} />
    </div>
  );
}
