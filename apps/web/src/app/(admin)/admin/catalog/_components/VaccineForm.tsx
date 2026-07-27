"use client";

import { useActionState } from "react";
import { upsertVaccineAction, type CatalogState } from "../_actions";
import { SubmitButton } from "@/components/ui/kit";

const field = "rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

export function VaccineForm({
  vaccine,
}: {
  vaccine?: {
    id: string;
    code: string;
    name_bn: string;
    name_en: string;
    total_doses: number;
    is_active: boolean;
  };
}) {
  const [state, action] = useActionState<CatalogState, FormData>(upsertVaccineAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {vaccine && <input type="hidden" name="id" value={vaccine.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          কোড
          <input name="code" defaultValue={vaccine?.code} required className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          মোট ডোজ
          <input
            name="total_doses"
            type="number"
            min={1}
            max={10}
            defaultValue={vaccine?.total_doses ?? 1}
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          বাংলা নাম
          <input name="name_bn" defaultValue={vaccine?.name_bn} required className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          ইংরেজি নাম
          <input name="name_en" defaultValue={vaccine?.name_en} required className={field} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="is_active" type="checkbox" defaultChecked={vaccine?.is_active ?? true} />
        সক্রিয়
      </label>
      {state?.error && <p className="text-sm text-[var(--color-danger)]">{state.error}</p>}
      {state?.ok && <p className="text-sm text-[var(--color-success)]">সংরক্ষণ হয়েছে।</p>}
      <div>
        <SubmitButton pendingLabel="সংরক্ষণ হচ্ছে…">
          {vaccine ? "সংরক্ষণ করুন" : "টিকা তৈরি করুন"}
        </SubmitButton>
      </div>
    </form>
  );
}
