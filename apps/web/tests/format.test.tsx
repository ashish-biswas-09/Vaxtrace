import { describe, expect, it } from "vitest";
import {
  toBn,
  fromBn,
  pctBn,
  dateBn,
  dateTimeBn,
  ageBn,
  daysUntil,
  todayIso,
} from "@/lib/format";

describe("format", () => {
  it("renders Bengali digits", () => {
    expect(toBn(2026)).toBe("২০২৬");
    expect(toBn("50 units")).toBe("৫০ units");
  });

  it("pctBn rounds and is null-safe", () => {
    expect(pctBn(0.583)).toBe("৫৮%");
    expect(pctBn(null)).toBe("—");
    expect(pctBn(undefined)).toBe("—");
  });

  it("dateBn reorders to dd/mm/yyyy in Bengali", () => {
    expect(dateBn("2026-08-03")).toBe("০৩/০৮/২০২৬");
    expect(dateBn(null)).toBe("—");
  });

  it("ageBn switches unit at 12 months", () => {
    const now = new Date();
    const sixMonths = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const threeYears = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    expect(ageBn(sixMonths.toISOString())).toBe("৬ মাস");
    expect(ageBn(threeYears.toISOString())).toBe("৩ বছর");
  });

  // The activity feed showed only the date, so eight entries from the same day were
  // indistinguishable. dateTimeBn is what makes a feed read as a feed.
  it("dateTimeBn keeps the time that dateBn drops", () => {
    const at = new Date(2026, 6, 25, 9, 5); // local, matching how the value is rendered
    expect(dateTimeBn(at.toISOString())).toBe("২৫/০৭/২০২৬ ০৯:০৫");
    expect(dateTimeBn(null)).toBe("—");
    expect(dateTimeBn("not-a-date")).toBe("—");
  });

  it("fromBn is the inverse of toBn, so IDs are typeable in either script", () => {
    expect(fromBn("১০০০০০০০০৮")).toBe("1000000008");
    expect(fromBn(toBn("1000000008"))).toBe("1000000008");
    expect(fromBn("BATCH-১২৩")).toBe("BATCH-123");
  });

  // Regression: todayIso() and daysUntil() must agree on which day "today" is. They did not
  // when today's UTC date and today's local date differed — i.e. before 06:00 in Bangladesh —
  // which made doses due today read as upcoming and batches expiring today read as expired.
  it("todayIso is the local calendar date and daysUntil agrees with it", () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(todayIso()).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    );
    expect(daysUntil(todayIso())).toBe(0);
  });

  it("daysUntil is signed", () => {
    expect(daysUntil(todayIso())).toBe(0);
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(
      daysUntil(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`),
    ).toBe(-5);
  });
});
