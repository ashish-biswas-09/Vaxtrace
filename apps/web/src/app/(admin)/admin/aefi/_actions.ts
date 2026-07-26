"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type AefiState = { error?: string; ok?: string } | undefined;

const schema = z
  .object({
    case_id: z.string().uuid(),
    status: z.enum(["reported", "under_investigation", "classified", "closed"]),
    severity: z.enum(["minor", "severe", "serious"]),
    outcome: z.enum([
      "recovered",
      "recovering",
      "recovered_with_sequelae",
      "not_recovered",
      "died",
      "unknown",
    ]),
    causality: z
      .enum([
        "vaccine_product",
        "immunization_error",
        "immunization_anxiety",
        "coincidental",
        "unclassifiable",
        "indeterminate",
      ])
      .optional(),
    investigation_note: z.string().trim().max(2000).optional(),
  })
  // The table enforces this too. Duplicating it here is deliberate: a constraint violation
  // reaches the user as a Postgres error string, and "select a causality" is what they need.
  .refine((v) => !["classified", "closed"].includes(v.status) || v.causality, {
    message: "শ্রেণিবদ্ধ করার আগে কার্যকারণ নির্ধারণ করতে হবে",
    path: ["causality"],
  });

// Classification is a supervisory act, not the reporting worker's. A causality assessment
// carries a clinical claim, and the person who gave the dose should not be the one judging
// whether it caused harm — the RLS update policy says the same thing in SQL.
export async function classifyCaseAction(
  _prev: AefiState,
  formData: FormData,
): Promise<AefiState> {
  const parsed = schema.safeParse({
    case_id: formData.get("case_id"),
    status: formData.get("status"),
    severity: formData.get("severity"),
    outcome: formData.get("outcome"),
    causality: formData.get("causality") || undefined,
    investigation_note: formData.get("investigation_note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("supervisor");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("aefi_cases")
    .update({
      status: parsed.data.status,
      severity: parsed.data.severity,
      outcome: parsed.data.outcome,
      causality: parsed.data.causality ?? null,
      investigation_note: parsed.data.investigation_note ?? null,
      investigated_by: user?.id ?? null,
    })
    .eq("id", parsed.data.case_id);

  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "এই কেসটি শ্রেণিবদ্ধ করার অনুমতি নেই — এটি সুপারভাইজার বা তার ঊর্ধ্বতনের কাজ।"
        : "কেস সংরক্ষণ করা যায়নি।",
    };
  }

  revalidatePath("/admin/aefi");
  return { ok: "কেস হালনাগাদ হয়েছে।" };
}
