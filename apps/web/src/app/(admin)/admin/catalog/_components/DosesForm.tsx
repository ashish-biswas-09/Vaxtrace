"use client";

import { useActionState } from "react";
import { upsertVaccineDosesAction, type CatalogState } from "../_actions";
import { SubmitButton } from "@/components/ui/kit";
import { toBn } from "@/lib/format";

const field = "w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm";

export function DosesForm({
  vaccineId,
  totalDoses,
  doses,
}: {
  vaccineId: string;
  totalDoses: number;
  doses: { dose_number: number; recommended_age_days: number; min_interval_days: number }[];
}) {
  const [state, action] = useActionState<CatalogState, FormData>(
    upsertVaccineDosesAction,
    undefined,
  );
  const byNumber = new Map(doses.map((d) => [d.dose_number, d]));
  const rows = Array.from({ length: totalDoses }, (_, i) => i + 1);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="vaccine_id" value={vaccineId} />
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-muted)]">
          <tr>
            <th scope="col" className="py-1 font-medium">ডোজ</th>
            <th scope="col" className="py-1 font-medium">প্রস্তাবিত বয়স (দিন)</th>
            <th scope="col" className="py-1 font-medium">ন্যূনতম বিরতি (দিন)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n}>
              <td className="py-1 pr-3">{toBn(n)}</td>
              <td className="py-1 pr-3">
                <input
                  name="recommended_age_days"
                  type="number"
                  min={0}
                  defaultValue={byNumber.get(n)?.recommended_age_days ?? 0}
                  required
                  className={field}
                />
              </td>
              <td className="py-1">
                <input
                  name="min_interval_days"
                  type="number"
                  min={0}
                  defaultValue={byNumber.get(n)?.min_interval_days ?? 0}
                  required
                  className={field}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {state?.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state?.ok && <p className="text-sm text-[var(--color-success)]">ডোজ সূচি সংরক্ষণ হয়েছে।</p>}
      <div>
        <SubmitButton variant="ghost" pendingLabel="সংরক্ষণ হচ্ছে…">
          ডোজ সূচি সংরক্ষণ করুন
        </SubmitButton>
      </div>
    </form>
  );
}
