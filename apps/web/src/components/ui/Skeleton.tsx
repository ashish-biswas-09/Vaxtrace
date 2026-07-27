// One `loading.tsx` — four cards and a block — was shown for all nine routes, so eight of
// them flashed a layout that had nothing to do with what arrived. These compose per route.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--r-md)] bg-[var(--surface-raised)] ${className}`} />;
}

export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="লোড হচ্ছে">
      <Skeleton className="h-8 w-52" />
      {children}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-[var(--r-lg)]" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-default)]">
      <div className="h-11 bg-[var(--surface-raised)]" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-t border-[var(--border-subtle)] p-3">
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
