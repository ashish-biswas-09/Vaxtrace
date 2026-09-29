// Regression tests for the কর্মসূচি audit fixes (docs/karmasuchi-audit.md).
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { parseCoverageParams } from "@/lib/coverageParams";
import { csvCell } from "@/lib/csv";
import { catchmentRoot, isUnder, type LocationNode } from "@/lib/locations";
import {
  aefiNextStatuses,
  COVERAGE_TARGET,
  coverageTone,
  isSeverityDowngrade,
  sessionState,
} from "@/lib/programme";
import { fillMonths, lastMonths } from "@/app/(admin)/admin/coverage/_components/TrendBars";
import { hrefWith, pageOf, sanitizeSearch } from "@/app/(admin)/admin/_components/ListControls";

vi.mock("@/app/(admin)/admin/aefi/_actions", () => ({
  classifyCaseAction: vi.fn(),
  severityReasonAction: vi.fn(async () => null),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/coverage" }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { AefiTable, type AefiRow } from "@/app/(admin)/admin/aefi/_components/AefiTable";
import { navFor } from "@/app/(admin)/admin/_components/AdminNav";

// K-01: each role's nav lists exactly the pages whose own guard admits it.
describe("navFor (K-01)", () => {
  const hrefs = (role: Parameters<typeof navFor>[0]) =>
    navFor(role).flatMap((g) => g.items.map((i) => i.href));

  it("gives a supervisor every কর্মসূচি screen and nothing programme-manager only", () => {
    const h = hrefs("supervisor");
    for (const p of ["/admin/coverage", "/admin/sessions", "/admin/reports", "/admin/aefi", "/admin/data-quality"]) {
      expect(h).toContain(p);
    }
    for (const p of ["/admin/children", "/admin/users", "/admin/settings", "/admin/population", "/admin/notifications"]) {
      expect(h).not.toContain(p);
    }
  });
  it("gives a programme manager the full nav", () => {
    expect(hrefs("programme_manager")).toContain("/admin/users");
    expect(hrefs("programme_manager").length).toBeGreaterThan(hrefs("supervisor").length);
  });
  it("gives a field worker and a signed-out reader nothing", () => {
    expect(hrefs("field_worker")).toEqual([]);
    expect(hrefs(null)).toEqual([]);
  });
});

describe("sessionState (K-05)", () => {
  const today = "2026-09-29";
  it("splits planned into upcoming and unreported by date", () => {
    expect(sessionState("planned", "2026-09-29", today)).toBe("upcoming");
    expect(sessionState("planned", "2026-10-01", today)).toBe("upcoming");
    expect(sessionState("planned", "2026-08-12", today)).toBe("unreported");
  });
  it("keeps held and cancelled whatever the date", () => {
    expect(sessionState("held", "2026-08-12", today)).toBe("held");
    expect(sessionState("cancelled", "2026-10-01", today)).toBe("cancelled");
  });
});

describe("AEFI transitions (mirror trg_aefi_transition)", () => {
  it("only moves forward", () => {
    expect(aefiNextStatuses("reported")).toEqual(["reported", "under_investigation", "classified", "closed"]);
    expect(aefiNextStatuses("classified")).toEqual(["classified", "closed"]);
  });
  it("lets a closed case be re-opened for investigation, nothing else", () => {
    expect(aefiNextStatuses("closed")).toEqual(["closed", "under_investigation"]);
  });
  it("recognises a severity downgrade", () => {
    expect(isSeverityDowngrade("serious", "severe")).toBe(true);
    expect(isSeverityDowngrade("minor", "serious")).toBe(false);
    expect(isSeverityDowngrade("severe", "severe")).toBe(false);
  });
});

describe("one coverage scale (K-10)", () => {
  it("turns green exactly at the target line", () => {
    expect(coverageTone(COVERAGE_TARGET)).toBe("success");
    expect(coverageTone(COVERAGE_TARGET - 0.01)).toBe("warning");
  });
});

describe("parseCoverageParams (K-07, K-14)", () => {
  const uuid = "3f1e4c1a-9b7d-4c2e-8a55-0d6f2b1c9e10";
  it("accepts well-formed values", () => {
    const p = parseCoverageParams(
      { area: "bd.dhaka", vaccine: uuid, year: "2025", from: "2025-01-01", to: "2025-06-30" },
      2026,
    );
    expect(p).toEqual({ area: "bd.dhaka", vaccine: uuid, year: 2025, from: "2025-01-01", to: "2025-06-30", invalid: false });
  });
  it("falls back and flags malformed values instead of passing them to SQL", () => {
    const p = parseCoverageParams({ area: "1.2)", vaccine: "x", year: "abc" }, 2026);
    expect(p).toMatchObject({ area: null, vaccine: null, year: 2026, invalid: true });
  });
  it("drops a reversed date range", () => {
    const p = parseCoverageParams({ from: "2026-09-01", to: "2026-01-01" }, 2026);
    expect(p).toMatchObject({ from: null, to: null, invalid: true });
  });
  it("treats absent values as defaults, not errors", () => {
    expect(parseCoverageParams({}, 2026)).toMatchObject({ year: 2026, invalid: false });
    expect(parseCoverageParams({ vaccine: "all" }, 2026).vaccine).toBe("all");
  });
});

describe("trend months (K-04)", () => {
  it("returns twelve consecutive months ending this month", () => {
    const m = lastMonths(12, new Date(2026, 8, 29));
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-10");
    expect(m[11]).toBe("2026-09");
  });
  it("zero-fills months the RPC did not return", () => {
    const filled = fillMonths([{ month: "2026-07-01", doses: 22 }], ["2026-07", "2026-08", "2026-09"]);
    expect(filled).toEqual([
      { month: "2026-07", doses: 22 },
      { month: "2026-08", doses: 0 },
      { month: "2026-09", doses: 0 },
    ]);
  });
});

describe("session site rules (K-17)", () => {
  const node = (path: string, level: LocationNode["level"]): LocationNode => ({
    id: path,
    name_bn: path,
    name_en: path,
    level,
    path,
    parent_id: null,
  });
  const byPath = new Map(
    [
      node("bd", "country"),
      node("bd.dhaka", "division"),
      node("bd.dhaka.gazipur", "district"),
      node("bd.dhaka.gazipur.sreepur", "upazila"),
      node("bd.dhaka.gazipur.sreepur.barmi", "union"),
    ].map((n) => [n.path, n]),
  );
  it("finds the facility's upazila from a union-level facility", () => {
    expect(catchmentRoot("bd.dhaka.gazipur.sreepur.barmi", byPath)).toBe("bd.dhaka.gazipur.sreepur");
  });
  it("tests subtree membership by path, not by prefix string", () => {
    expect(isUnder("bd.dhaka.gazipur.sreepur.barmi", "bd.dhaka.gazipur.sreepur")).toBe(true);
    expect(isUnder("bd.dhaka.gazipur.sreepur2", "bd.dhaka.gazipur.sreepur")).toBe(false);
  });
});

describe("list controls", () => {
  it("strips PostgREST filter syntax but keeps Bengali and session codes", () => {
    expect(sanitizeSearch("SES-000060,status.eq.held)")).toBe("SES-000060statuseqheld");
    expect(sanitizeSearch("শ্রীপুর")).toBe("শ্রীপুর");
  });
  it("reads a 1-based page param as a 0-based index", () => {
    expect(pageOf("3")).toBe(2);
    expect(pageOf("-1")).toBe(0);
    expect(pageOf(undefined)).toBe(0);
  });
  it("builds hrefs without empty params", () => {
    expect(hrefWith("/admin/sessions", { q: "x", filter: undefined }, { page: "2" })).toBe(
      "/admin/sessions?q=x&page=2",
    );
  });
});

describe("csvCell (S-8)", () => {
  it("neutralises formula-looking text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("@SUM")).toBe("'@SUM");
  });
  it("leaves numbers and ordinary text alone", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("বিসিজি")).toBe("বিসিজি");
  });
});

// K-02: opening a second case must show that case's values, not the first one's.
describe("AefiTable classify dialog (K-02)", () => {
  beforeAll(() => {
    // jsdom has no modal dialog; opening is all these tests need.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  const row = (over: Partial<AefiRow>): AefiRow => ({
    id: "id",
    code: "AEFI-000000",
    status: "reported",
    severity: "minor",
    outcome: "unknown",
    causality: null,
    onset_date: "2026-05-01",
    symptoms: "জ্বর",
    note: null,
    child_id: "c",
    child_code: "1",
    child_name: "শিশু",
    area: "—",
    facility: "—",
    vaccine: "—",
    batch: null,
    reported_by: "—",
    investigated_by: null,
    overdue: false,
    ...over,
  });

  it("resets severity and status when another case is opened", () => {
    const a = row({ id: "a", code: "AEFI-000010", child_name: "তাসনিম", severity: "severe", status: "reported" });
    const b = row({ id: "b", code: "AEFI-000007", child_name: "আবির", severity: "minor", status: "under_investigation" });
    render(<AefiTable rows={[a, b]} empty="—" />);

    const openCase = (name: string) => {
      // DataTable renders a card list and a table; use the table row.
      const cell = screen.getAllByText(name).map((el) => el.closest("tr")).find(Boolean)!;
      fireEvent.click(within(cell).getByRole("button"));
    };

    openCase("তাসনিম");
    openCase("আবির");

    const dialog = document.querySelector("dialog[open]")!;
    expect(dialog.textContent).toContain("AEFI-000007");
    const severity = dialog.querySelector<HTMLSelectElement>("select[name=severity]")!;
    const status = dialog.querySelector<HTMLSelectElement>("select[name=status]")!;
    const caseId = dialog.querySelector<HTMLInputElement>("input[name=case_id]")!;
    expect(caseId.value).toBe("b");
    expect(severity.value).toBe("minor");
    expect(status.value).toBe("under_investigation");
  });
});
