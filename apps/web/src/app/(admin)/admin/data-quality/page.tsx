import Link from "next/link";
import { requireAppRole } from "@/lib/auth";
import { dateBn, toBn } from "@/lib/format";
import { UNKNOWN_PHONE } from "@/lib/guardians";
import { selectAll } from "@/lib/paged";
import { LEVEL_LABEL_BN, type LocationNode } from "@/lib/locations";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui/kit";
import { Callout } from "../_components/Callout";
export const metadata = { title: "তথ্যের মান" };

export const dynamic = "force-dynamic";

type Tone = "muted" | "success" | "warning" | "danger";
const lagTone = (hours: number | null): Tone =>
  hours == null ? "muted" : hours <= 24 ? "success" : hours <= 72 ? "warning" : "danger";

// "৮২৬৭ ঘণ্টা" is not a number anyone can read; past two days the unit is days.
const lagBn =(hours: number) =>
  hours < 48 ? `${toBn(Math.round(hours))} ঘণ্টা` : `${toBn(Math.round(hours / 24))} দিন`;

// Data quality (BS-11). Every column is computed from data the schema already held; this is
// the screen that answers "should I believe the coverage number on the previous screen?"
export default async function DataQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ issues?: string; detail?: string; area?: string }>;
}) {
  const { supabase } = await requireAppRole("supervisor");
  const sp = await searchParams;
  const onlyIssues = sp.issues === "1";
  const detail = sp.detail === "no-phone" || sp.detail === "no-facility" ? sp.detail : null;
  const detailArea = sp.area && /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(sp.area) ? sp.area : null;
  const here = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ issues: onlyIssues ? "1" : undefined, ...over })) if (v) q.set(k, v);
    return `/admin/data-quality${q.size ? `?${q}` : ""}`;
  };

  const [{ data: rows, error }, { data: locations }] = await Promise.all([
    supabase.from("v_data_quality").select("*").order("location_path"),
    supabase.from("locations").select("id, name_bn, name_en, level, path, parent_id").is("valid_to", null),
  ]);
  if (error) console.error("v_data_quality", error);

  const areas = rows ?? [];
  const level = new Map(((locations ?? []) as LocationNode[]).map((l) => [l.path, l.level]));
  const paths = new Set(areas.map((a) => a.location_path ?? ""));

  // The headline is the caller's own top level: every row with no ancestor in the result. For
  // a national user that is the country; for an upazila manager, their upazila. Reading only
  // the country row showed a scoped user ০ with a green tick (K-20).
  const top = areas.filter((a) => {
    const parts = (a.location_path ?? "").split(".");
    return !parts.slice(0, -1).some((_, i) => paths.has(parts.slice(0, i + 1).join(".")));
  });
  const sum = (k: "guardians_without_phone" | "doses_without_facility" | "children_without_brn") =>
    top.reduce((s, a) => s + Number(a[k] ?? 0), 0);
  const headLag = top.length === 1 ? top[0].median_entry_lag_hours : null;

  const hasIssue = (a: (typeof areas)[number]) =>
    (a.guardians_without_phone ?? 0) > 0 ||
    (a.doses_without_facility ?? 0) > 0 ||
    lagTone(a.median_entry_lag_hours ?? null) === "danger";
  // The country row repeats the total of the one below it and is on every trail; the table
  // starts at the division (pathTrail drops the root for the same reason).
  const shown = (onlyIssues ? areas.filter(hasIssue) : areas).filter(
    (a) => level.get(a.location_path ?? "") !== "country",
  );

  const noPhone = sum("guardians_without_phone");
  const noFacility = sum("doses_without_facility");
  const th = "px-4 py-3 font-medium";
  const drill = detail ? await detailRows(supabase, detail, detailArea) : null;
  const areaName = (path: string | null) =>
    path ? (areas.find((a) => a.location_path === path)?.location_name ?? path) : "সমগ্র দায়িত্বাধীন এলাকা";
  const cellLink = (n: number, kind: "no-phone" | "no-facility", path: string | null, cls = "") =>
    n > 0 ? (
      <Link href={here({ detail: kind, area: path ?? undefined })} className={`hover:underline ${cls}`}>
        {toBn(n)}
      </Link>
    ) : (
      toBn(0)
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="তথ্যের মান" description="এলাকা অনুযায়ী তথ্যের ঘাটতি ও এন্ট্রিতে দেরি।" />

      {error && (
        <Callout tone="danger" title="তথ্যের মানের হিসাব দেখানো যাচ্ছে না">
          একটু পরে আবার চেষ্টা করুন।
        </Callout>
      )}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="এন্ট্রিতে দেরি (মধ্যক)"
          value={headLag != null ? lagBn(headLag) : "—"}
          tone={lagTone(headLag ?? null)}
          hint={
            top.length > 1
              ? "একাধিক এলাকা — নিচের তালিকায় এলাকা অনুযায়ী দেখুন"
              : "ডোজ দেওয়া থেকে রেকর্ড এন্ট্রি পর্যন্ত মধ্যক সময়"
          }
        />
        <StatCard
          label="ফোন নম্বর নেই এমন অভিভাবক"
          value={toBn(noPhone)}
          tone={noPhone > 0 ? "danger" : "success"}
          hint="এঁদের কাছে রিমাইন্ডার পৌঁছাবে না"
          href={noPhone > 0 ? here({ detail: "no-phone" }) : undefined}
        />
        <StatCard
          label="কেন্দ্রের নাম ছাড়া ডোজ"
          value={toBn(noFacility)}
          tone={noFacility > 0 ? "warning" : "success"}
          hint="কেন্দ্রভিত্তিক রিপোর্টে গণনা হবে না"
          href={noFacility > 0 ? here({ detail: "no-facility" }) : undefined}
        />
        <StatCard
          label="জন্ম নিবন্ধন নেই"
          value={toBn(sum("children_without_brn"))}
          tone="muted"
          hint="জন্ম নিবন্ধন ছাড়াও শিশু নিবন্ধন করা যায়"
        />
      </section>

      {drill && (
        <section
          aria-labelledby="dq-detail"
          className="rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-5"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="dq-detail" className="text-lg font-medium">
              {detail === "no-phone" ? "ফোন নম্বর নেই এমন অভিভাবক" : "কেন্দ্রের নাম ছাড়া ডোজ"} ·{" "}
              {areaName(detailArea)} ({toBn(drill.length)})
            </h2>
            <Link href={here({})} className="text-sm text-[var(--accent)]">
              বন্ধ করুন
            </Link>
          </div>
          {drill.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">কিছু পাওয়া যায়নি।</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--surface-raised)] text-left text-[var(--text-secondary)]">
                  <tr>
                    {drill[0].cells.map((_, i) => (
                      <th key={i} scope="col" className={th}>
                        {(detail === "no-phone"
                          ? ["অভিভাবক", "শিশু", "শিশু আইডি"]
                          : ["শিশু", "শিশু আইডি", "টিকা ও ডোজ", "তারিখ"])[i]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drill.map((r) => (
                    <tr key={r.key} className="border-t border-[var(--border-subtle)]">
                      {r.cells.map((c, i) => (
                        <td key={i} className="px-4 py-2">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[var(--text-secondary)]">
          {toBn(shown.length)}টি এলাকা দেখানো হচ্ছে ·
        </span>
        <Link
          href={onlyIssues ? "/admin/data-quality" : "/admin/data-quality?issues=1"}
          className="text-[var(--accent)]"
        >
          {onlyIssues ? "সব এলাকা দেখুন" : "শুধু সমস্যাযুক্ত এলাকা দেখুন"}
        </Link>
      </p>

      {/* The box scrolls, not the page, so the sticky header has something to stick to. */}
      <section className="max-h-[70vh] overflow-auto rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)]">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">এলাকা অনুযায়ী তথ্যের মান</caption>
          <thead className="sticky top-0 z-10 bg-[var(--surface-raised)] text-left text-[var(--text-secondary)]">
            <tr>
              <th scope="col" className={th}>এলাকা</th>
              <th scope="col" className={`${th} text-right`}>শিশু</th>
              <th scope="col" className={`${th} text-right`}>সক্রিয়</th>
              <th scope="col" className={`${th} text-right`}>একীভূত (ডুপ্লিকেট)</th>
              <th scope="col" className={`${th} text-right`}>ফোন নম্বর নেই</th>
              <th scope="col" className={`${th} text-right`}>কেন্দ্র ছাড়া ডোজ</th>
              <th scope="col" className={th}>এন্ট্রিতে দেরি</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => {
              const depth = Math.max(0, (a.location_path ?? "").split(".").length - 2);
              const lvl = level.get(a.location_path ?? "");
              return (
                <tr key={a.location_path} className="border-t border-[var(--border-subtle)]">
                  <td className="px-4 py-2.5">
                    <span style={{ paddingInlineStart: `${depth * 1.25}rem` }} className="block">
                      {a.location_name}
                      {lvl && (
                        <span className="ml-2 text-xs text-[var(--text-muted)]">{LEVEL_LABEL_BN[lvl]}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{toBn(a.children ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{toBn(a.active_children ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-muted)]">
                    {toBn(a.merged_children ?? 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {cellLink(a.guardians_without_phone ?? 0, "no-phone", a.location_path, "text-[var(--danger)]")}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {cellLink(a.doses_without_facility ?? 0, "no-facility", a.location_path, "text-[var(--accent)]")}
                  </td>
                  <td className="px-4 py-2.5">
                    {a.median_entry_lag_hours == null ? (
                      <span className="text-[var(--text-muted)]">—</span>
                    ) : (
                      <StatusBadge tone={lagTone(a.median_entry_lag_hours)}>{lagBn(a.median_entry_lag_hours)}</StatusBadge>
                    )}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  {onlyIssues ? "কোনো এলাকায় সমস্যা পাওয়া যায়নি।" : "কোনো তথ্য নেই।"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

type DetailRow = { key: string; cells: React.ReactNode[] };

// The rows behind a Data Quality number, counted with v_data_quality's own rule so the list is
// as long as the number clicked (P3-5): non-deleted children whose location is at or under the
// area, their guardian's placeholder phone, their un-voided doses with no facility. Rendered
// here rather than linked out because the guardian and child lists are programme-manager
// screens and this one is a supervisor's too.
async function detailRows(
  supabase: Awaited<ReturnType<typeof requireAppRole>>["supabase"],
  kind: "no-phone" | "no-facility",
  area: string | null,
): Promise<DetailRow[]> {
  const kids = await selectAll(() =>
    supabase
      .from("children")
      .select("id, child_id, full_name, guardian_id, location_path")
      .is("deleted_at", null)
      .order("id"),
  );
  const inArea = kids.filter(
    (k) => !area || k.location_path === area || k.location_path?.startsWith(`${area}.`),
  );
  const kidById = new Map(inArea.map((k) => [k.id, k]));

  if (kind === "no-phone") {
    const ids = [...new Set(inArea.map((k) => k.guardian_id))];
    const guardians = ids.length
      ? ((
          await supabase.from("guardians").select("id, full_name").eq("phone", UNKNOWN_PHONE).in("id", ids)
        ).data ?? [])
      : [];
    return guardians.map((g) => {
      const children = inArea.filter((k) => k.guardian_id === g.id);
      return {
        key: g.id,
        cells: [
          g.full_name,
          children.map((c) => c.full_name).join(", "),
          <span key="id" className="font-mono text-xs">
            {children.map((c) => toBn(c.child_id)).join(", ")}
          </span>,
        ],
      };
    });
  }

  const [records, { data: vaccines }] = await Promise.all([
    selectAll(() =>
      supabase
        .from("vaccination_records")
        .select("id, child_id, vaccine_id, dose_number, administered_date")
        .is("facility_id", null)
        .is("voided_at", null)
        .order("administered_date", { ascending: false }),
    ),
    supabase.from("vaccines").select("id, name_bn"),
  ]);
  const vaxName = new Map((vaccines ?? []).map((v) => [v.id, v.name_bn]));
  return records
    .filter((r) => kidById.has(r.child_id))
    .map((r) => {
      const k = kidById.get(r.child_id)!;
      return {
        key: r.id,
        cells: [
          <Link key="c" href={`/admin/children/${k.id}`} className="text-[var(--accent)]">
            {k.full_name}
          </Link>,
          <span key="id" className="font-mono text-xs">{toBn(k.child_id)}</span>,
          `${vaxName.get(r.vaccine_id) ?? "—"} · ডোজ ${toBn(r.dose_number)}`,
          dateBn(r.administered_date),
        ],
      };
    });
}
