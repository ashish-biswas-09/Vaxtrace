import { requireRole } from "@/lib/auth";

// Placeholder — replaced by the real D1 Admin Dashboard (Section 2, TODO 2.1).
export default async function AdminDashboardPage() {
  await requireRole("admin");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">অ্যাডমিন ড্যাশবোর্ড</h1>
      <p className="text-[var(--color-muted)]">D1 নির্মাণাধীন।</p>
    </main>
  );
}
