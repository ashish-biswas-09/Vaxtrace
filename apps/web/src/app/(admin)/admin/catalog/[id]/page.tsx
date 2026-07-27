import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { VaccineForm } from "../_components/VaccineForm";
import { DosesForm } from "../_components/DosesForm";
import { SetBreadcrumb } from "../../_components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function EditVaccinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await requireRole("admin");

  const { data: vaccine } = await supabase
    .from("vaccines")
    .select("id, code, name_bn, name_en, total_doses, is_active")
    .eq("id", id)
    .single();
  if (!vaccine) notFound();

  const { data: doses } = await supabase
    .from("vaccine_doses")
    .select("dose_number, recommended_age_days, min_interval_days")
    .eq("vaccine_id", id)
    .order("dose_number");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SetBreadcrumb label={vaccine.name_bn} />
      <div>
        <Link href="/admin/catalog" className="text-sm text-[var(--color-muted)] hover:underline">
          ← টিকা তালিকা
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{vaccine.name_bn}</h1>
        <p className="text-sm text-[var(--color-muted)]">{vaccine.code}</p>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-4 text-lg font-medium">টিকার তথ্য</h2>
        <VaccineForm vaccine={vaccine} />
      </section>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-1 text-lg font-medium">ডোজ সূচি</h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          ডোজ সংখ্যা টিকার “মোট ডোজ” অনুযায়ী। উপরে মোট ডোজ পরিবর্তন করে সংরক্ষণ করলে সারি সংখ্যা
          হালনাগাদ হবে।
        </p>
        <DosesForm vaccineId={vaccine.id} totalDoses={vaccine.total_doses} doses={doses ?? []} />
      </section>
    </div>
  );
}
