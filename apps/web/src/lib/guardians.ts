import type { Database } from "@vaxtrace/db-types";

// Guardian and child-lifecycle vocabulary. Client-safe: no server import, so both a Server
// Component and a `"use client"` form can read it (the trap lib/auth.ts falls into).

export type ChildStatus = Database["public"]["Enums"]["child_status"];
export type GuardianRelationship = Database["public"]["Enums"]["guardian_relationship"];

export const RELATIONSHIP_LABEL_BN: Record<GuardianRelationship, string> = {
  mother: "মা",
  father: "বাবা",
  grandparent: "দাদা/দাদি/নানা/নানি",
  sibling: "ভাই/বোন",
  other_relative: "অন্য আত্মীয়",
  caregiver: "তত্ত্বাবধায়ক",
};

// Tone carries meaning here, so it is data rather than a conditional at each call site.
// `reachable` is the property that decides whether a reminder may ever be sent — it mirrors
// child_is_reachable() in SQL, and getting it wrong is how a bereaved family gets texted.
export const CHILD_STATUS: Record<
  ChildStatus,
  { label: string; tone: "success" | "muted" | "warning" | "danger"; reachable: boolean; hint: string }
> = {
  active: {
    label: "সক্রিয়",
    tone: "success",
    reachable: true,
    hint: "নিয়মিত টিকার সূচিতে আছে",
  },
  moved_out: {
    label: "এলাকা ছেড়েছে",
    tone: "muted",
    reachable: false,
    hint: "এই এলাকার হিসাব থেকে বাদ; রিমাইন্ডার বন্ধ",
  },
  transferred: {
    label: "স্থানান্তরিত",
    tone: "muted",
    reachable: false,
    hint: "অন্য কেন্দ্রে স্থানান্তরিত; রিমাইন্ডার বন্ধ",
  },
  refused: {
    label: "অভিভাবক অসম্মত",
    tone: "warning",
    reachable: false,
    // Still counted in the denominator on purpose: a refusal is a programme outcome to work
    // on, not a child who stopped existing.
    hint: "রিমাইন্ডার বন্ধ, তবে লক্ষ্য জনসংখ্যায় গণনা চলবে",
  },
  deceased: {
    label: "মৃত",
    tone: "danger",
    reachable: false,
    hint: "সব বার্তা তাৎক্ষণিকভাবে বন্ধ",
  },
  aged_out: {
    label: "বয়স পেরিয়েছে",
    tone: "muted",
    reachable: false,
    hint: "নিয়মিত সূচির বয়সসীমা পেরিয়েছে",
  },
};

export const CHILD_STATUSES = Object.keys(CHILD_STATUS) as ChildStatus[];

// A phone the migration could not recover from the old profile-based model. It is never sent
// to, and the data-quality screen counts it.
export const UNKNOWN_PHONE = "+000000000000";

export function hasUsablePhone(phone: string | null | undefined): boolean {
  return Boolean(phone) && phone !== UNKNOWN_PHONE;
}
