import { SkeletonCards, SkeletonPage, Skeleton } from "@/components/ui/Skeleton";

// Dashboard-shaped, because that is the route this file covers. Each other route now has its
// own — one generic skeleton for nine layouts flashed the wrong shape on eight of them.
export default function AdminLoading() {
  return (
    <SkeletonPage>
      <SkeletonCards count={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-80 rounded-[var(--r-lg)]" />
        <Skeleton className="h-80 rounded-[var(--r-lg)]" />
      </div>
    </SkeletonPage>
  );
}
