import type { Database } from "@vaxtrace/db-types";

// One vocabulary for the service-delivery, supply and safety enums, in one file, imported by
// both Server and Client Components. UX-03 in the report: terminology drift across roles is
// what happens when three screens each translate the same enum. This is the single copy.
//
// Client-safe by construction — it imports nothing but types.

type Enums = Database["public"]["Enums"];

// --- Sessions ---------------------------------------------------------------

export const SESSION_TYPE_BN: Record<Enums["session_type"], string> = {
  fixed: "নির্ধারিত কেন্দ্র",
  outreach: "আউটরিচ",
  campaign: "ক্যাম্পেইন",
};

export const SESSION_STATUS_BN: Record<Enums["session_status"], { label: string; tone: Tone }> = {
  planned: { label: "পরিকল্পিত", tone: "primary" },
  held: { label: "সম্পন্ন", tone: "success" },
  cancelled: { label: "বাতিল", tone: "danger" },
};

// --- Stock ------------------------------------------------------------------

export const STOCK_TXN_BN: Record<Enums["stock_txn_type"], { label: string; tone: Tone }> = {
  receipt: { label: "গ্রহণ", tone: "success" },
  transfer_in: { label: "স্থানান্তর (আগত)", tone: "success" },
  transfer_out: { label: "স্থানান্তর (প্রেরিত)", tone: "warning" },
  administered: { label: "প্রয়োগকৃত", tone: "primary" },
  wastage: { label: "অপচয়", tone: "danger" },
  adjustment: { label: "সমন্বয়", tone: "muted" },
};

export const WASTAGE_REASON_BN: Record<Enums["wastage_reason"], string> = {
  open_vial: "খোলা ভায়াল (সেশন শেষে)",
  vvm: "VVM পর্যায় ৩/৪",
  breakage: "ভাঙা",
  expiry: "মেয়াদোত্তীর্ণ",
  frozen: "জমে যাওয়া",
  other: "অন্যান্য",
};

// The transaction types a human enters by hand. `administered` is written by the dose trigger
// and `transfer_in`/`transfer_out` by issue_requisition() — offering them on a form would
// create ledger rows with no requisition behind them.
export const MANUAL_TXN_TYPES: Enums["stock_txn_type"][] = ["receipt", "wastage", "adjustment"];

export const REQUISITION_STATUS_BN: Record<
  Enums["requisition_status"],
  { label: string; tone: Tone }
> = {
  submitted: { label: "জমা দেওয়া", tone: "primary" },
  approved: { label: "অনুমোদিত", tone: "success" },
  rejected: { label: "প্রত্যাখ্যাত", tone: "danger" },
  issued: { label: "প্রেরিত", tone: "warning" },
  received: { label: "গৃহীত", tone: "success" },
  cancelled: { label: "বাতিল", tone: "muted" },
};

// --- Cold chain -------------------------------------------------------------

export const DEVICE_KIND_BN: Record<Enums["cold_chain_device_kind"], string> = {
  ilr: "আইস-লাইনড রেফ্রিজারেটর",
  deep_freezer: "ডিপ ফ্রিজার",
  vaccine_carrier: "ভ্যাকসিন ক্যারিয়ার",
  cold_box: "কোল্ড বক্স",
  walk_in_cooler: "ওয়াক-ইন কুলার",
};

// --- Tracing ----------------------------------------------------------------

export const TRACING_STATUS_BN: Record<Enums["tracing_status"], { label: string; tone: Tone }> = {
  open: { label: "অপেক্ষমাণ", tone: "warning" },
  assigned: { label: "বরাদ্দকৃত", tone: "primary" },
  visited: { label: "পরিদর্শিত", tone: "success" },
  closed: { label: "নিষ্পন্ন", tone: "muted" },
};

export const TRACING_OUTCOME_BN: Record<Enums["tracing_outcome"], string> = {
  vaccinated: "টিকা দেওয়া হয়েছে",
  appointment_given: "পরবর্তী সেশনের তারিখ দেওয়া হয়েছে",
  refused: "অভিভাবক রাজি হননি",
  moved_away: "পরিবার এলাকা ছেড়েছে",
  deceased: "শিশুটি মারা গেছে",
  not_found: "ঠিকানায় পাওয়া যায়নি",
  unreachable: "যোগাযোগ করা যায়নি",
};

// The three outcomes that change the child's lifecycle, and therefore stop every future
// reminder and remove the child from the defaulter list. The form says so before the click —
// trg_tracing_outcome() is what does it, and a worker should not discover that afterwards.
export const OUTCOMES_THAT_CLOSE_THE_CHILD: Enums["tracing_outcome"][] = [
  "moved_away",
  "deceased",
  "refused",
];

// --- AEFI -------------------------------------------------------------------

export const AEFI_SEVERITY_BN: Record<Enums["aefi_severity"], { label: string; tone: Tone }> = {
  minor: { label: "মৃদু", tone: "muted" },
  severe: { label: "গুরুতর", tone: "warning" },
  serious: { label: "মারাত্মক", tone: "danger" },
};

export const AEFI_STATUS_BN: Record<Enums["aefi_status"], { label: string; tone: Tone }> = {
  reported: { label: "রিপোর্টকৃত", tone: "warning" },
  under_investigation: { label: "তদন্তাধীন", tone: "primary" },
  classified: { label: "শ্রেণিবদ্ধ", tone: "success" },
  closed: { label: "নিষ্পন্ন", tone: "muted" },
};

// WHO causality assessment categories, translated but not reinterpreted. A classification that
// does not use these cannot be reported upward or compared with anything.
export const AEFI_CAUSALITY_BN: Record<Enums["aefi_causality"], string> = {
  vaccine_product: "টিকার নিজস্ব প্রতিক্রিয়া",
  immunization_error: "টিকাদান প্রক্রিয়ার ত্রুটি",
  immunization_anxiety: "টিকাভীতিজনিত প্রতিক্রিয়া",
  coincidental: "কাকতালীয় (টিকার সঙ্গে সম্পর্কহীন)",
  unclassifiable: "তথ্য অপর্যাপ্ত",
  indeterminate: "অনিশ্চিত",
};

export const AEFI_OUTCOME_BN: Record<Enums["aefi_outcome"], string> = {
  recovered: "সম্পূর্ণ সুস্থ",
  recovering: "সুস্থ হচ্ছে",
  recovered_with_sequelae: "সুস্থ, তবে জটিলতা রয়ে গেছে",
  not_recovered: "সুস্থ হয়নি",
  died: "মৃত্যু",
  unknown: "জানা নেই",
};

export type Tone = "muted" | "success" | "warning" | "danger" | "primary";

// --- Coverage presentation --------------------------------------------------

// UX-07, empty vs zero: `—` when there is no denominator to divide by, a real Bengali
// percentage when the denominator exists and the answer genuinely is zero. Conflating the two
// is how a catchment with no population estimate comes to look like a catchment with no
// coverage, which is the opposite of the truth.
export function coverageTone(rate: number | null | undefined): Tone {
  if (rate == null) return "muted";
  if (rate >= 0.9) return "success";
  if (rate >= 0.7) return "warning";
  return "danger";
}

// The WHO reading of a dropout rate: above 10% the programme is losing children between doses
// faster than it should, and that is a different problem from low coverage — it means they
// came once and did not come back.
export function dropoutTone(rate: number | null | undefined): Tone {
  if (rate == null) return "muted";
  if (rate > 0.1) return "danger";
  if (rate > 0.05) return "warning";
  return "success";
}
