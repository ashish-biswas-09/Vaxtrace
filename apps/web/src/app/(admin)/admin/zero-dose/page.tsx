import Link from "next/link";
import { requireAppRole } from "@/lib/auth";
import { ageBn, dateBn, todayIso, toBn } from "@/lib/format";
import { pathTrail, type LocationNode } from "@/lib/locations";
import { selectAll } from "@/lib/paged";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/kit";
import { PrintButton } from "../_components/PrintButton";
import { ZeroDoseTable, type ZeroDoseRow } from "./_components/ZeroDoseTable";
export const metadata = { title: "শূন্য-ডোজ শিশু" };

export const dynamic = "force-dynamic";

type Source = {
  child_id: string | null;
  child_code: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  location_path: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  marker_due_date: string | null;
  age_days: number | null;
};

const monthsAgo = (months: number) => {
  const [y, m, d] = todayIso().split("-").map(Number);
  const dt = new Date(y, m - 1 - months, d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

// The zero-dose indicator in the form a worker can act on.
//
// Two windows, named differently because they are different numbers:
//   default   UNDER 12 months — the children who can still be reached in time (v_zero_dose)
//   ?window=12-23   12–23 months — the WHO indicator the coverage screen counts, so its
//                   "শূন্য-ডোজ" link lands on a list exactly as long as the number clicked (K-12)
export default async function ZeroDosePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; window?: string }>;
}) {
  const { supabase } = await requireAppRole("supervisor");
  const { area, window } = await searchParams;
  const indicator = window === "12-23";

  const [{ data: locations }, { data: marker }] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name_bn, name_en, level, path, parent_id")
      .is("valid_to", null)
      .order("path"),
    supabase
      .from("vaccines")
      .select("id, code, name_bn")
      .eq("is_zero_dose_marker", true)
      .maybeSingle(),
  ]);

  const nodes = (locations ?? []) as LocationNode[];
  const byPath = new Map(nodes.map((l) => [l.path, l]));

  if (!marker) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="শূন্য-ডোজ শিশু" />
        <EmptyState
          title="শূন্য-ডোজের সূচক নির্ধারণ করা হয়নি"
          hint="কোন টিকার প্রথম ডোজ দিয়ে শূন্য-ডোজ মাপা হবে (সাধারণত পেন্টাভ্যালেন্ট), তা টিকা তালিকায় চিহ্নিত করুন।"
          action={{ href: "/admin/catalog", label: "টিকা তালিকায় যান" }}
        />
      </div>
    );
  }

  const source: Source[] = indicator
    ? await indicatorWindow(supabase, marker.id)
    : ((
        await supabase
          .from("v_zero_dose")
          .select("child_id, child_code, full_name, date_of_birth, location_path, guardian_name, guardian_phone, address, marker_due_date, age_days")
          .order("date_of_birth")
      ).data ?? []);

  // The area filter is a path-prefix test, exactly as the SQL side does it — clicking a
  // zero-dose count on the coverage screen has to land on that area's children and no others.
  const filtered = source.filter(
    (r) => !area || r.location_path === area || r.location_path?.startsWith(`${area}.`),
  );

  const list: ZeroDoseRow[] = filtered.map((r) => ({
    child_id: r.child_id ?? "",
    child_code: r.child_code ?? "",
    full_name: r.full_name ?? "",
    age: ageBn(r.date_of_birth),
    age_days: Number(r.age_days ?? 0),
    area: r.location_path ? pathTrail(r.location_path, byPath) : "—",
    guardian_name: r.guardian_name ?? "—",
    guardian_phone: r.guardian_phone ?? "—",
    address: r.address ?? "—",
    due_date: r.marker_due_date ? dateBn(r.marker_due_date) : "—",
  }));

  // Under six months is still comfortably within the schedule's own catch-up window; past it,
  // the child is at real risk of never starting.
  const urgent = list.filter((r) => r.age_days >= 180).length;
  const band = indicator ? "১২–২৩ মাস বয়সী" : "১২ মাসের কম বয়সী";
  const other = indicator
    ? { href: `/admin/zero-dose${area ? `?area=${encodeURIComponent(area)}` : ""}`, label: "১২ মাসের কম বয়সীদের তালিকা" }
    : { href: `/admin/zero-dose?window=12-23${area ? `&area=${encodeURIComponent(area)}` : ""}`, label: "১২–২৩ মাস বয়সীদের তালিকা" };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={indicator ? "শূন্য-ডোজ শিশু (১২–২৩ মাস)" : "শূন্য-ডোজ শিশু (১২ মাসের কম)"}
        description={`${band} যেসব শিশু ${marker.name_bn}-এর প্রথম ডোজ এখনো পায়নি।`}
        actions={<PrintButton />}
      />

      <div className="print-only text-sm">
        <p>
          <strong>এলাকা:</strong> {area ? pathTrail(area, byPath) : "সমগ্র দায়িত্বাধীন এলাকা"} ·{" "}
          <strong>বয়স:</strong> {band} · <strong>মোট:</strong> {toBn(list.length)} জন
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:hidden">
        <StatCard
          label="শূন্য-ডোজ শিশু"
          value={toBn(list.length)}
          tone={list.length > 0 ? "danger" : "success"}
          hint={band}
        />
        {!indicator && (
          <StatCard
            label="৬ মাসের বেশি বয়সী"
            value={toBn(urgent)}
            tone={urgent > 0 ? "danger" : "success"}
            hint="সূচির স্বাভাবিক ক্যাচ-আপ সীমা পেরিয়ে গেছে"
          />
        )}
        <StatCard
          label="ফলো-আপ বোর্ড"
          value="→"
          tone="primary"
          href="/admin/tracing"
          hint="এই শিশুদের পরিদর্শনের দায়িত্ব দিন"
        />
      </section>

      <p className="text-sm text-[var(--text-secondary)] print:hidden">
        {area && (
          <>
            {pathTrail(area, byPath)} এলাকায় সীমাবদ্ধ ·{" "}
            <Link
              href={indicator ? "/admin/zero-dose?window=12-23" : "/admin/zero-dose"}
              className="text-[var(--accent)]"
            >
              সব এলাকা দেখুন
            </Link>{" "}
            ·{" "}
          </>
        )}
        <Link href={other.href} className="text-[var(--accent)]">
          {other.label}
        </Link>
      </p>

      {list.length === 0 ? (
        <EmptyState
          title="এই এলাকায় কোনো শূন্য-ডোজ শিশু নেই"
          hint={`${band} প্রতিটি নিবন্ধিত শিশু অন্তত প্রথম ডোজ পেয়েছে। অনিবন্ধিত শিশু এই তালিকায় আসে না।`}
          action={{ href: "/admin/coverage", label: "কভারেজ দেখুন" }}
        />
      ) : (
        <ZeroDoseTable rows={list} />
      )}
    </div>
  );
}

// The 12–23 month window, computed with the same predicate coverage_by_area() counts with:
// active, not deleted, born 12–24 months ago, no un-voided first dose of the marker antigen.
// Every read is the caller's own RLS-scoped client.
// ponytail: aggregates in the app; move to a view (extend v_zero_dose with an age band) if the
// 12–23 month cohort in one scope grows past a few thousand children.
async function indicatorWindow(
  supabase: Awaited<ReturnType<typeof requireAppRole>>["supabase"],
  markerId: string,
): Promise<Source[]> {
  const [kids, given] = await Promise.all([
    selectAll(() =>
      supabase
        .from("children")
        .select("id, child_id, full_name, date_of_birth, location_path, guardian_id")
        .is("deleted_at", null)
        .eq("status", "active")
        .lte("date_of_birth", monthsAgo(12))
        .gt("date_of_birth", monthsAgo(24))
        .order("date_of_birth"),
    ),
    selectAll(() =>
      supabase
        .from("vaccination_records")
        .select("child_id")
        .eq("vaccine_id", markerId)
        .eq("dose_number", 1)
        .is("voided_at", null)
        .order("child_id"),
    ),
  ]);

  const reached = new Set(given.map((r) => r.child_id));
  const zero = kids.filter((k) => !reached.has(k.id));
  const guardianIds = [...new Set(zero.map((k) => k.guardian_id))];
  const { data: guardians } = guardianIds.length
    ? await supabase.from("guardians").select("id, full_name, phone, address").in("id", guardianIds)
    : { data: [] as { id: string; full_name: string; phone: string | null; address: string | null }[] };
  const gById = new Map((guardians ?? []).map((g) => [g.id, g]));
  const today = new Date(todayIso()).getTime();

  return zero.map((k) => {
    const g = gById.get(k.guardian_id);
    return {
      child_id: k.id,
      child_code: k.child_id,
      full_name: k.full_name,
      date_of_birth: k.date_of_birth,
      location_path: k.location_path,
      guardian_name: g?.full_name ?? null,
      guardian_phone: g?.phone ?? null,
      address: g?.address ?? null,
      marker_due_date: null,
      age_days: Math.round((today - new Date(k.date_of_birth).getTime()) / 86_400_000),
    };
  });
}
