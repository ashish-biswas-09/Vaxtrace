import { describe, expect, it } from "vitest";
import {
  findDuplicateGroups,
  normaliseName,
  suggestWinner,
  type DupChild,
} from "@/app/(admin)/admin/duplicates/duplicates";
import { coverageTone, dropoutTone, MANUAL_TXN_TYPES } from "@/lib/programme";

// Fixtures shaped like the register, not like the test: two records of the same child with a
// spacing difference, a twin who legitimately shares everything but a name, and an unrelated
// child who must not be dragged into anybody's group.
function child(over: Partial<DupChild> & { id: string }): DupChild {
  return {
    child_id: `100000000${over.id}`,
    full_name: "রহিমা খাতুন",
    date_of_birth: "2025-03-01",
    guardian_id: "g1",
    guardian_name: "সালমা বেগম",
    guardian_phone: "+8801711000001",
    created_at: "2025-03-10T00:00:00Z",
    birth_registration_no: null,
    doses: 0,
    ...over,
  };
}

describe("normaliseName", () => {
  it("mirrors normalise_name() in SQL: casefold, collapse punctuation and spacing", () => {
    expect(normaliseName("  রহিমা   খাতুন ")).toBe("রহিমা খাতুন");
    expect(normaliseName("Rahima  Khatun")).toBe("rahima khatun");
    // The whole point of the normalisation: these two must land in the same bucket, because
    // a duplicate created by a stray space is the commonest duplicate there is.
    expect(normaliseName("রহিমা খাতুন")).toBe(normaliseName("রহিমা  খাতুন"));
  });

  it("keeps genuinely different names apart", () => {
    expect(normaliseName("রহিমা খাতুন")).not.toBe(normaliseName("করিমা খাতুন"));
  });
});

describe("findDuplicateGroups", () => {
  it("groups the same name and date of birth", () => {
    const groups = findDuplicateGroups([
      child({ id: "1", full_name: "রহিমা খাতুন" }),
      child({ id: "2", full_name: "রহিমা  খাতুন" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].children.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("reports one group per pair, not one per matching rule", () => {
    // Same name, same DOB AND same guardian phone: two rules fire on the same two children.
    // Showing that pair twice is how a reviewer learns to distrust the queue.
    const groups = findDuplicateGroups([child({ id: "1" }), child({ id: "2" })]);
    expect(groups).toHaveLength(1);
    // And the stronger of the two signals is the one reported.
    expect(groups[0].confidence).toBe("high");
  });

  it("ranks a shared birth registration number as certain", () => {
    const groups = findDuplicateGroups([
      child({ id: "1", full_name: "রহিমা খাতুন", birth_registration_no: "12345678901234567" }),
      child({ id: "2", full_name: "সম্পূর্ণ ভিন্ন নাম", date_of_birth: "2024-01-01",
              guardian_phone: "+8801711000099", birth_registration_no: "12345678901234567" }),
    ]);
    expect(groups[0].confidence).toBe("exact");
  });

  it("still surfaces twins, because the queue warns rather than decides", () => {
    // Twins share a surname, a date of birth and a phone number. They appear here as a
    // `possible` match and a human dismisses them — which is the correct behaviour, and the
    // reason registration warns instead of blocking.
    const groups = findDuplicateGroups([
      child({ id: "1", full_name: "রহিমা খাতুন" }),
      child({ id: "2", full_name: "হালিমা খাতুন" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe("possible");
  });

  it("leaves unrelated children out of every group", () => {
    const groups = findDuplicateGroups([
      child({ id: "1" }),
      child({ id: "2" }),
      child({
        id: "3",
        full_name: "করিম উদ্দিন",
        date_of_birth: "2023-07-14",
        guardian_phone: "+8801711000777",
      }),
    ]);
    expect(groups.flatMap((g) => g.children.map((c) => c.id))).not.toContain("3");
  });

  it("returns nothing when every child is distinct", () => {
    expect(
      findDuplicateGroups([
        child({ id: "1" }),
        child({
          id: "2",
          full_name: "করিম উদ্দিন",
          date_of_birth: "2023-07-14",
          guardian_phone: "+8801711000777",
        }),
      ]),
    ).toEqual([]);
  });
});

describe("suggestWinner", () => {
  it("keeps the record with more doses, so a merge moves less history", () => {
    const winner = suggestWinner([
      child({ id: "1", doses: 1, created_at: "2025-01-01T00:00:00Z" }),
      child({ id: "2", doses: 4, created_at: "2025-06-01T00:00:00Z" }),
    ]);
    expect(winner.id).toBe("2");
  });

  it("falls back to the older registration, whose ID is on the family's card", () => {
    const winner = suggestWinner([
      child({ id: "1", doses: 2, created_at: "2025-06-01T00:00:00Z" }),
      child({ id: "2", doses: 2, created_at: "2025-01-01T00:00:00Z" }),
    ]);
    expect(winner.id).toBe("2");
  });
});

describe("coverage presentation", () => {
  it("distinguishes no denominator from a real zero (UX-07)", () => {
    // The rule the whole coverage screen rests on: null renders as an em dash, 0 renders as
    // ০%. Collapsing them makes an area with no population estimate look like an area with no
    // coverage, which is the opposite of what is true.
    expect(coverageTone(null)).toBe("muted");
    expect(coverageTone(0)).toBe("danger");
  });

  it("bands coverage at the thresholds the programme is judged on", () => {
    expect(coverageTone(0.95)).toBe("success");
    expect(coverageTone(0.9)).toBe("success");
    expect(coverageTone(0.75)).toBe("warning");
    expect(coverageTone(0.5)).toBe("danger");
  });

  it("treats dropout above 10% as the WHO alarm threshold", () => {
    expect(dropoutTone(0.11)).toBe("danger");
    expect(dropoutTone(0.08)).toBe("warning");
    expect(dropoutTone(0.02)).toBe("success");
    expect(dropoutTone(null)).toBe("muted");
  });
});

describe("stock vocabulary", () => {
  it("offers only the transaction types a human enters by hand", () => {
    // `administered` is written by the dose trigger and the transfer pair by
    // issue_requisition(). Putting them on a form would create ledger rows with no dose and no
    // requisition behind them — movements that reconcile to nothing.
    expect(MANUAL_TXN_TYPES).toEqual(["receipt", "wastage", "adjustment"]);
    expect(MANUAL_TXN_TYPES).not.toContain("administered");
    expect(MANUAL_TXN_TYPES).not.toContain("transfer_in");
    expect(MANUAL_TXN_TYPES).not.toContain("transfer_out");
  });
});
