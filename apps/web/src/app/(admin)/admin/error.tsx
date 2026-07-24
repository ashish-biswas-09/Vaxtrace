"use client";

// Error boundary for the /admin subtree (audit D1) — a failed Supabase query shows a retry,
// not a blank screen or a crash. Must be a client component per Next.js.
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-[var(--color-danger)] p-6">
      <div>
        <h2 className="text-lg font-medium">কিছু একটা সমস্যা হয়েছে</h2>
        <p className="text-sm text-[var(--color-muted)]">
          তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
      >
        আবার চেষ্টা করুন
      </button>
    </div>
  );
}
