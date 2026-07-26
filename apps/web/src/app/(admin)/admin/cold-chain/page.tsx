import { mfaGate, requireAppRole } from "@/lib/auth";
import { dateTimeBn, toBn } from "@/lib/format";
import { DEVICE_KIND_BN } from "@/lib/programme";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "../_components/ui";
import { AddDeviceForm } from "./_components/AddDeviceForm";
import { ReadingForm } from "./_components/ReadingForm";
import { ReadingsTable, type ReadingRow } from "./_components/ReadingsTable";

export const dynamic = "force-dynamic";

// The cold chain (report FR-27).
//
// A vaccine held outside its temperature range is not a vaccine, and until now no screen here
// could say whether any had been. The two failure modes are reported side by side and given
// equal weight on purpose:
//
//   ভ্রমণ (excursion)  a device reported a bad number
//   নীরব   (silent)     a device reported nothing
//
// The second is the worse one. A programme that stopped logging has usually stopped looking,
// and a fridge that has been silent for a week is not a fridge anybody is watching.
export default async function ColdChainPage() {
  const { supabase, claims } = await requireAppRole("store_keeper");
  await mfaGate(supabase, claims);

  const [{ data: devices }, { data: readings }, { data: facilities }] = await Promise.all([
    supabase
      .from("v_cold_chain")
      .select("device_id, device_name, kind, facility_id, facility_name_bn, min_c, max_c, is_active, last_temperature_c, last_reading_at, readings_7d, excursions_7d, has_excursion, is_silent")
      .order("facility_name_bn"),
    supabase
      .from("cold_chain_readings")
      .select("id, device_id, reading_at, temperature_c, action_taken")
      .order("reading_at", { ascending: false })
      .limit(300),
    supabase.from("facilities").select("id, name_bn").eq("is_active", true).order("name_bn"),
  ]);

  const list = (devices ?? []).filter((d) => d.is_active);
  const byId = new Map(list.map((d) => [d.device_id, d]));

  const rows: ReadingRow[] = (readings ?? []).map((r) => {
    const d = byId.get(r.device_id);
    return {
      id: r.id,
      at: r.reading_at,
      temperature: Number(r.temperature_c),
      device: d?.device_name ?? "—",
      facility: d?.facility_name_bn ?? "—",
      // The excursion test is per device, computed against that device's own range — a
      // freezer at −20 °C is correct and a fridge at −20 °C has ruined its contents.
      is_excursion:
        d != null &&
        (Number(r.temperature_c) < Number(d.min_c) || Number(r.temperature_c) > Number(d.max_c)),
      range: d ? `${d.min_c}–${d.max_c} °C` : "—",
      action: r.action_taken,
    };
  });

  const excursions = list.filter((d) => d.has_excursion).length;
  const silent = list.filter((d) => d.is_silent).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="কোল্ড চেইন"
        description="প্রতিটি যন্ত্রের নিজস্ব তাপমাত্রার সীমা অনুযায়ী দিনে দুইবারের রেকর্ড। রেকর্ড একবার লেখা হলে আর সম্পাদনা করা যায় না — এটি সাক্ষ্য, তথ্য নয়।"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="সক্রিয় যন্ত্র" value={toBn(list.length)} />
        <StatCard
          label="সীমা ভেঙেছে (৭ দিন)"
          value={toBn(excursions)}
          tone={excursions > 0 ? "danger" : "success"}
          hint="নির্ধারিত তাপমাত্রার বাইরে অন্তত একটি রেকর্ড"
        />
        <StatCard
          label="নীরব যন্ত্র"
          value={toBn(silent)}
          tone={silent > 0 ? "danger" : "success"}
          hint="২৪ ঘণ্টায় কোনো রেকর্ড নেই — সীমা ভাঙার চেয়েও বড় ঝুঁকি"
        />
      </section>

      {list.length === 0 ? (
        <EmptyState
          title="কোনো যন্ত্র নিবন্ধিত নেই"
          hint="ফ্রিজ, ফ্রিজার বা ভ্যাকসিন ক্যারিয়ার যোগ করলে তার তাপমাত্রার রেকর্ড রাখা শুরু করা যাবে।"
        />
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-medium">যন্ত্রের অবস্থা</h2>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-[var(--color-border)]/40 text-left text-[var(--color-muted)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">যন্ত্র</th>
                  <th scope="col" className="px-4 py-3 font-medium">কেন্দ্র</th>
                  <th scope="col" className="px-4 py-3 font-medium">সীমা</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">সর্বশেষ</th>
                  <th scope="col" className="px-4 py-3 font-medium">সময়</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">৭ দিনে রেকর্ড</th>
                  <th scope="col" className="px-4 py-3 font-medium">অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.device_id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2.5">
                      {d.device_name}
                      <span className="block text-xs text-[var(--color-muted)]">
                        {d.kind ? DEVICE_KIND_BN[d.kind] : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{d.facility_name_bn}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">
                      {d.min_c}–{d.max_c} °C
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {d.last_temperature_c == null ? "—" : `${d.last_temperature_c} °C`}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {d.last_reading_at ? dateTimeBn(d.last_reading_at) : "কখনো নয়"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {toBn(d.readings_7d ?? 0)}
                      {(d.excursions_7d ?? 0) > 0 && (
                        <span className="ml-1 text-xs text-[var(--color-danger)]">
                          ({toBn(d.excursions_7d ?? 0)} বার সীমার বাইরে)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {/* Text inside every pill, never colour alone (§16.5). */}
                      {d.is_silent ? (
                        <StatusBadge tone="danger">নীরব</StatusBadge>
                      ) : d.has_excursion ? (
                        <StatusBadge tone="warning">সীমা ভেঙেছে</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">স্বাভাবিক</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {list.length > 0 && (
        <section className="rounded-xl border border-[var(--color-border)] p-5">
          <h2 className="mb-4 text-lg font-medium">তাপমাত্রা লিখুন</h2>
          <ReadingForm
            devices={list.map((d) => ({
              id: d.device_id ?? "",
              label: `${d.facility_name_bn} · ${d.device_name} (${d.min_c}–${d.max_c} °C)`,
              min_c: Number(d.min_c),
              max_c: Number(d.max_c),
            }))}
          />
        </section>
      )}

      {rows.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">রেকর্ডের ইতিহাস</h2>
          <ReadingsTable rows={rows} />
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="mb-1 text-lg font-medium">যন্ত্র যোগ করুন</h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          সীমা যন্ত্রভেদে আলাদা: রুটিন ইপিআই ফ্রিজ +২ থেকে +৮ °C, আর ওপিভির ডিপ ফ্রিজার −২৫
          থেকে −১৫ °C। একটিমাত্র সীমা ধরে নিলে প্রতিটি সঠিক ফ্রিজার রিডিংও ভুল দেখাত।
        </p>
        <AddDeviceForm
          facilities={(facilities ?? []).map((f) => ({ id: f.id, label: f.name_bn }))}
        />
      </section>
    </div>
  );
}
