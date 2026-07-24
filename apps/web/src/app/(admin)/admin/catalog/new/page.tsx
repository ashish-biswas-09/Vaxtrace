import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { VaccineForm } from "../_components/VaccineForm";

export default async function NewVaccinePage() {
  await requireRole("admin");
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/admin/catalog" className="text-sm text-[var(--color-muted)] hover:underline">
          ← টিকা তালিকা
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">নতুন টিকা</h1>
        <p className="text-sm text-[var(--color-muted)]">
          তৈরি করার পর ডোজ সূচি যোগ করার জন্য সম্পাদনা পৃষ্ঠায় নিয়ে যাওয়া হবে।
        </p>
      </div>
      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <VaccineForm />
      </section>
    </div>
  );
}
