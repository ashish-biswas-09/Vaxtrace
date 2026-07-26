import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ageBn, dateBn, toBn } from "@/lib/format";
import { pathTrail, type LocationNode } from "@/lib/locations";
import { EmptyState, PageHeader, StatCard } from "../_components/ui";
import { PrintButton } from "../_components/PrintButton";
import { ZeroDoseTable, type ZeroDoseRow } from "./_components/ZeroDoseTable";

export const dynamic = "force-dynamic";

// The zero-dose indicator in the form a worker can act on.
//
// The percentage belongs on the coverage screen; nobody can visit a percentage. This is the
// list: a name, an age, an address and a phone number per row, printable, so it goes into a
// pocket and comes back with ticks on it. It is deliberately the UNDER-twelve-months window
// rather than the 12–23 month indicator window — these are the children who can still be
// reached in time, and reaching them is the point.
export default async function ZeroDosePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const supabase = await requireRole("admin");
  const { area } = await searchParams;

  const [{ data: rows }, { data: locations }, { data: marker }] = await Promise.all([
    supabase
      .from("v_zero_dose")
      .select("child_id, child_code, full_name, date_of_birth, gender, location_path, guardian_name, guardian_phone, address, marker_due_date, age_days")
      .order("date_of_birth"),
    supabase
      .from("locations")
      .select("id, name_bn, name_en, level, path, parent_id")
      .is("valid_to", null)
      .order("path"),
    supabase.from("vaccines").select("code, name_bn").eq("is_zero_dose_marker", true).maybeSingle(),
  ]);

  const nodes = (locations ?? []) as LocationNode[];
  const byPath = new Map(nodes.map((l) => [l.path, l]));

  // The area filter is a path-prefix test, exactly as the SQL side does it — clicking a
  // zero-dose count on the coverage screen has to land on that area's children and no others.
  const filtered = (rows ?? []).filter(
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
  // the child is at real risk of never starting. Splitting the count says which of the two
  // problems this list is.
  const urgent = list.filter((r) => r.age_days >= 180).length;

  if (!marker) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="শূন্য-ডোজ শিশু" />
        <EmptyState
          title="শূন্য-ডোজের সূচক নির্ধারণ করা হয়নি"
          hint="কোন টিকার প্রথম ডোজ দিয়ে শূন্য-ডোজ মাপা হবে (সাধারণত পেন্টাভ্যালেন্ট) তা টিকা তালিকায় চিহ্নিত করতে হবে। চিহ্নিত না করে অনুমান করলে সংখ্যাটি ভুল টিকার বিপরীতে হিসাব হবে।"
          action={{ href: "/admin/catalog", label: "টিকা তালিকায় যান" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="শূন্য-ডোজ শিশু"
        description={`১২ মাসের কম বয়সী যেসব শিশু ${marker.name_bn}-এর প্রথম ডোজ এখনো পায়নি। এরাই সেই শিশু, যাদের কাছে কর্মসূচি একবারও পৌঁছায়নি।`}
        actions={<PrintButton label="তালিকা ছাপুন" />}
      />

      <div className="print-only text-sm">
        <p>
          <strong>এলাকা:</strong> {area ? pathTrail(area, byPath) : "সমগ্র দায়িত্বাধীন এলাকা"} ·{" "}
          <strong>মোট:</strong> {toBn(list.length)} জন
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3 print:hidden">
        <StatCard
          label="শূন্য-ডোজ শিশু"
          value={toBn(list.length)}
          tone={list.length > 0 ? "danger" : "success"}
          hint="১২ মাসের কম বয়সী"
        />
        <StatCard
          label="৬ মাসের বেশি বয়সী"
          value={toBn(urgent)}
          tone={urgent > 0 ? "danger" : "success"}
          hint="সময়সূচির স্বাভাবিক ক্যাচ-আপ সীমা পেরিয়ে গেছে"
        />
        <StatCard
          label="ফলো-আপ বোর্ড"
          value="→"
          tone="primary"
          href="/admin/tracing"
          hint="এই শিশুদের জন্য পরিদর্শনের দায়িত্ব বরাদ্দ করুন"
        />
      </section>

      {area && (
        <p className="text-sm text-[var(--color-muted)] print:hidden">
          {pathTrail(area, byPath)} এলাকায় সীমাবদ্ধ ·{" "}
          <Link href="/admin/zero-dose" className="text-[var(--color-primary)]">
            সব এলাকা দেখুন
          </Link>
        </p>
      )}

      {list.length === 0 ? (
        <EmptyState
          title="এই এলাকায় কোনো শূন্য-ডোজ শিশু নেই"
          hint="১২ মাসের কম বয়সী প্রতিটি নিবন্ধিত শিশু অন্তত প্রথম ডোজ পেয়েছে। মনে রাখুন, এটি শুধু নিবন্ধিত শিশুদের কথা বলে — এলাকায় অনিবন্ধিত শিশু থাকলে তারা এখানে আসবে না, সেটি এলাকাভিত্তিক কভারেজের নিবন্ধন হার দেখলে বোঝা যাবে।"
          action={{ href: "/admin/coverage", label: "কভারেজ দেখুন" }}
        />
      ) : (
        <ZeroDoseTable rows={list} />
      )}
    </div>
  );
}
