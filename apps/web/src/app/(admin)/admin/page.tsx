import { Suspense } from "react";
import { redirect } from "next/navigation";
import { appRoleAtLeast, requireAppRole } from "@/lib/auth";
import { dateTimeBn } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ChildrenIcon, DownloadIcon, PlusIcon, RefreshIcon } from "@/components/icons";
import { buildWindow, getChildrenCount } from "./_queries";
import { rangeDays } from "./_components/ranges";
import { EmptyState, PageHeader } from "@/components/ui/kit";
import {
  SessionPlan,
  AlertRail,
  BlockSkeleton,
  KpiRow,
  KpiSkeleton,
  Queues,
  Trends,
} from "./_components/dashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "ড্যাশবোর্ড" };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  // The dashboard reads programme-wide queues guarded at programme_manager. A supervisor's
  // home in /admin is their own scope's coverage.
  const { claims } = await requireAppRole("supervisor");
  if (!appRoleAtLeast(claims.appRole, "programme_manager")) redirect("/admin/coverage");

  const { range } = await searchParams;
  const w = buildWindow(rangeDays(range));

  // First run: an admin looking at a dashboard of dashes needs to be told what to do, not left
  // to guess whether the system is broken or simply empty.
  const childrenCount = await getChildrenCount();
  if (childrenCount === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="ড্যাশবোর্ড" />
        <EmptyState
          icon={<ChildrenIcon size={22} />}
          title="এখনো কোনো শিশু নিবন্ধিত নেই"
          hint="প্রথম শিশু নিবন্ধন করলেই তার ১০-সংখ্যার আইডি ও সম্পূর্ণ টিকার সূচি স্বয়ংক্রিয়ভাবে তৈরি হবে, এবং এই ড্যাশবোর্ডে কভারেজ ও ফলো-আপ দেখা যাবে।"
          action={{ href: "/admin/children/new", label: "শিশু নিবন্ধন করুন" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ড্যাশবোর্ড"
        description="টিকাদান কর্মসূচির সারসংক্ষেপ"
        // Every number below is "now" with nothing saying so. A dashboard that gets
        // screenshotted into a report needs to carry its own timestamp.
        meta={`হালনাগাদ: ${dateTimeBn(new Date().toISOString())}`}
        actions={
          <>
            <Button
              href="/admin/children/new"
              size="sm"
              variant="secondary"
              icon={<PlusIcon size={16} />}
            >
              শিশু নিবন্ধন
            </Button>
            <Button
              href="/admin/inventory/new"
              size="sm"
              variant="secondary"
              icon={<PlusIcon size={16} />}
            >
              ব্যাচ যোগ
            </Button>
            <Button
              href="/admin/notifications"
              size="sm"
              variant="secondary"
              icon={<RefreshIcon size={16} />}
            >
              রিমাইন্ডার
            </Button>
            <Button
              href="/admin/reports/export"
              size="sm"
              variant="secondary"
              icon={<DownloadIcon size={16} />}
            >
              রপ্তানি
            </Button>
          </>
        }
      />

      {/* Each zone streams on its own. The alert rail no longer waits behind the coverage
          view, which is the slowest query on the screen and the least urgent. */}
      <Suspense fallback={null}>
        <AlertRail />
      </Suspense>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiRow w={w} />
      </Suspense>

      <Suspense fallback={<BlockSkeleton className="h-80" />}>
        <Trends w={w} />
      </Suspense>

      <Suspense fallback={<BlockSkeleton className="h-64" />}>
        <Queues />
      </Suspense>

      <Suspense fallback={<BlockSkeleton className="h-56" />}>
        <SessionPlan />
      </Suspense>
    </div>
  );
}
