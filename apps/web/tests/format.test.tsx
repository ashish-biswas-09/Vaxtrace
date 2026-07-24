import { describe, expect, it } from "vitest";
import { toBn, pctBn, dateBn, ageBn, daysUntil } from "@/lib/format";

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

  it("daysUntil is signed", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(daysUntil(today)).toBe(0);
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    expect(daysUntil(past)).toBe(-5);
  });
});
