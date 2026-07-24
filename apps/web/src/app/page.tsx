import Link from "next/link";

export default function SplashPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">ভ্যাক্সট্রেস</h1>
        <p className="text-[var(--color-muted)]">শিশুদের টিকাদান ট্র্যাকিং সিস্টেম</p>
      </div>
      <Link
        href="/role"
        className="rounded-md bg-[var(--color-primary)] px-6 py-3 text-[var(--color-primary-fg)]"
      >
        শুরু করুন
      </Link>
    </main>
  );
}
