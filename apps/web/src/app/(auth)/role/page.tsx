import Link from "next/link";

const ROLES = [
  { role: "parent", label: "অভিভাবক" },
  { role: "worker", label: "স্বাস্থ্যকর্মী" },
  { role: "admin", label: "অ্যাডমিন" },
] as const;

export default function RoleSelectionPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-2xl font-semibold">আপনি কে হিসেবে প্রবেশ করছেন?</h1>
      <div className="flex w-full max-w-sm flex-col gap-4">
        {ROLES.map(({ role, label }) => (
          <Link
            key={role}
            href={`/sign-in?role=${role}`}
            className="rounded-md border border-[var(--color-border)] px-4 py-3 text-center hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-fg)]"
          >
            {label}
          </Link>
        ))}
      </div>
    </main>
  );
}
