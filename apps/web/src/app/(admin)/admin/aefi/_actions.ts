"use server";

import { requireAppRole } from "@/lib/auth";
import { aefiNextStatuses, isSeverityDowngrade } from "@/lib/programme";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type AefiState = { error?: string; ok?: string } | undefined;

// Empty is allowed; anything typed must meet the table's own 3-character floor, or the save
// failed with an unexplained "সংরক্ষণ করা যায়নি" (K-16).
const optionalText = (max: number, msg: string) =>
  z.string().trim().min(3, msg).max(max).optional().or(z.literal("").transform(() => undefined));

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
    investigation_note: optionalText(2000, "তদন্তের বিবরণ অন্তত ৩ অক্ষরের হতে হবে"),
    severity_change_reason: optionalText(300, "মাত্রা কমানোর কারণ অন্তত ৩ অক্ষরের হতে হবে"),
  })
  // The table enforces this too. Duplicating it here is deliberate: a constraint violation
  // reaches the user as a Postgres error string, and "select a causality" is what they need.
  .refine((v) => !["classified", "closed"].includes(v.status) || v.causality, {
    message: "শ্রেণিবদ্ধ বা নিষ্পন্ন করার আগে কার্যকারণ বেছে নিন",
    path: ["causality"],
  });

// Why the case's severity was last lowered, if it was (S-6). Null when there is none, or when
// the column does not exist yet (the 20260929100000 migration not applied), so the dialog
// simply omits the line instead of failing.
export async function severityReasonAction(caseId: string): Promise<string | null> {
  if (!z.string().uuid().safeParse(caseId).success) return null;
  const { supabase } = await requireAppRole("supervisor");
  const { data, error } = await supabase
    .from("aefi_cases")
    .select("severity_change_reason")
    .eq("id", caseId)
    .maybeSingle();
  return error ? null : (data?.severity_change_reason ?? null);
}

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
    investigation_note: formData.get("investigation_note") ?? "",
    severity_change_reason: formData.get("severity_change_reason") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  const v = parsed.data;

  const { supabase } = await requireAppRole("supervisor");

  // Read the case as it is now: the allowed moves, the investigator and a downgrade all depend
  // on it. RLS returns nothing for a case outside the caller's scope.
  const { data: current } = await supabase
    .from("aefi_cases")
    .select("status, severity, investigated_by")
    .eq("id", v.case_id)
    .maybeSingle();
  if (!current) return { error: "কেসটি পাওয়া যায়নি বা আপনার এলাকার বাইরে।" };

  if (!aefiNextStatuses(current.status).includes(v.status)) {
    return { error: "এই অবস্থা থেকে সেই অবস্থায় যাওয়া যায় না। কেস শুধু সামনের ধাপে যায়; নিষ্পন্ন কেস আবার তদন্তে খোলা যায়।" };
  }
  const downgrade = isSeverityDowngrade(current.severity, v.severity);
  if (downgrade && !v.severity_change_reason) {
    return { error: "মাত্রা কমালে কারণ লিখতে হবে — এতে ৪৮ ঘণ্টার তদন্ত-সীমার সতর্কতা উঠে যায়।" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("aefi_cases")
    .update({
      status: v.status,
      severity: v.severity,
      outcome: v.outcome,
      causality: v.causality ?? null,
      investigation_note: v.investigation_note ?? null,
      // The investigator is whoever first took the case, not whoever saved it last (S-5).
      ...(current.investigated_by ? {} : { investigated_by: user?.id ?? null }),
      ...(downgrade ? { severity_change_reason: v.severity_change_reason } : {}),
    })
    .eq("id", v.case_id)
    .select("id");

  if (error) {
    console.error("classifyCaseAction", error);
    return { error: "কেস সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।" };
  }
  // An UPDATE that RLS filters out affects no rows and raises nothing (K-06).
  if (!data || data.length === 0) {
    return {
      error: "এই কেস পরিবর্তনের অনুমতি আপনার নেই। সুপারভাইজার বা ঊর্ধ্বতন কর্মকর্তা এটি করতে পারবেন।",
    };
  }

  revalidatePath("/admin/aefi");
  return { ok: "কেস হালনাগাদ হয়েছে।" };
}
