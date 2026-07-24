// Skeleton shown while any /admin server component streams (audit D1). A few pulsing bars —
// enough to signal "loading" without matching each page's exact layout.
export default function AdminLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="লোড হচ্ছে">
      <div className="h-8 w-48 rounded bg-[var(--color-border)]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[var(--color-border)]" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-[var(--color-border)]" />
    </div>
  );
}
