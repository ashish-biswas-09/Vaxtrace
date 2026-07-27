import { requireAppRole } from "@/lib/auth";
import { toBn } from "@/lib/format";
import { StatCard, StatusBadge } from "@/components/ui/kit";
export const metadata = { title: "তথ্যের মান" };

export const dynamic = "force-dynamic";

// Data quality (BS-11). WHO's own guidance treats verification as part of the information
// system rather than an afterthought, and every column on this screen is computed from data
// the schema already held — the entry-lag metric in particular was sitting unused, because
// vaccination_records has always stored both administered_date and created_at.
//
// A screen like this reads as professional for the same reason it is useful: it is the only
// place that answers "should I believe the coverage number on the previous screen?"
export default async function DataQualityPage() {
  const { supabase } = await requireAppRole("supervisor");

  const { data: rows } = await supabase
    .from("v_data_quality")
    .select("*")
    .order("location_path");

  const areas = rows ?? [];

  // Roll the flags up once so the headline numbers do not require the reader to scan a table.
  // The country root already aggregates everything below it, so it is the natural total.
  const root = areas.find((a) => (a.location_path ?? "").split(".").length === 1);

  const lagTone = (hours: number | null) =>
    hours == null ? "muted" : hours <= 24 ? "success" : hours <= 72 ? "warning" : "danger";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">তথ্যের মান</h1>
        <p className="text-sm text-[var(--color-muted)]">
          কভারেজের সংখ্যা বিশ্বাস করার আগে যাচাই। প্রতিটি হিসাব ইতিমধ্যে সংরক্ষিত তথ্য থেকেই তৈরি
          — নতুন কোনো ডেটা এন্ট্রি লাগে না।
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="এন্ট্রির গড় বিলম্ব"
          value={
            root?.median_entry_lag_hours != null
              ? `${toBn(Math.round(root.median_entry_lag_hours))} ঘণ্টা`
              : "—"
          }
          tone={lagTone(root?.median_entry_lag_hours ?? null)}
          hint="ডোজ দেওয়া ও তথ্য এন্ট্রির মধ্যবর্তী মধ্যক সময়"
        />
        <StatCard
          label="নম্বরবিহীন অভিভাবক"
          value={toBn(root?.guardians_without_phone ?? 0)}
          tone={(root?.guardians_without_phone ?? 0) > 0 ? "danger" : "success"}
          hint="রিমাইন্ডার পৌঁছাবে না"
        />
        <StatCard
          label="কেন্দ্রবিহীন ডোজ"
          value={toBn(root?.doses_without_facility ?? 0)}
          tone={(root?.doses_without_facility ?? 0) > 0 ? "warning" : "success"}
          hint="কোথায় দেওয়া হয়েছে অজানা — কেন্দ্রভিত্তিক রিপোর্টে গণনা হবে না"
        />
        <StatCard
          label="জন্ম নিবন্ধন নেই"
          value={toBn(root?.children_without_brn ?? 0)}
          tone="muted"
          hint="স্বাভাবিক — নিবন্ধনের পূর্বশর্ত নয়"
        />
      </section>

      <section className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">এলাকা</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">শিশু</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">সক্রিয়</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">একীভূত</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">নম্বর নেই</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">কেন্দ্রবিহীন ডোজ</th>
              <th scope="col" className="px-4 py-3 font-medium">এন্ট্রি বিলম্ব</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => {
              const depth = (a.location_path ?? "").split(".").length - 1;
              return (
                <tr key={a.location_path} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2.5">
                    <span style={{ paddingInlineStart: `${depth * 1.25}rem` }} className="block">
                      {a.location_name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{toBn(a.children ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right">{toBn(a.active_children ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-muted)]">
                    {toBn(a.merged_children ?? 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {(a.guardians_without_phone ?? 0) > 0 ? (
                      <span className="text-[var(--color-danger)]">
                        {toBn(a.guardians_without_phone ?? 0)}
                      </span>
                    ) : (
                      // A real zero, not a missing value — the distinction the prior UI/UX
                      // audit drew on the Children screen, applied here too.
                      toBn(0)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {toBn(a.doses_without_facility ?? 0)}
                  </td>
                  <td className="px-4 py-2.5">
                    {a.median_entry_lag_hours == null ? (
                      <span className="text-[var(--color-muted)]">—</span>
                    ) : (
                      <StatusBadge tone={lagTone(a.median_entry_lag_hours)}>
                        {toBn(Math.round(a.median_entry_lag_hours))} ঘণ্টা
                      </StatusBadge>
                    )}
                  </td>
                </tr>
              );
            })}
            {areas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  কোনো তথ্য নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
