import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
import { batchStatus } from "@/app/(admin)/admin/inventory/status";
import { childCoverage } from "@/app/(admin)/admin/children/coverage";
import { filterRows } from "@/app/(admin)/admin/_components/DataTable";
import { auditLabel } from "@/app/(admin)/admin/_audit";

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe("batchStatus", () => {
  it("expiry wins over healthy stock", () => {
    expect(batchStatus(500, iso(-1)).tone).toBe("danger"); // expired
    expect(batchStatus(500, iso(10)).tone).toBe("warning"); // expiring ≤30d
  });
  it("flags empty and low stock", () => {
    expect(batchStatus(0, iso(365)).tone).toBe("danger");
    expect(batchStatus(40, iso(365)).tone).toBe("warning");
  });
  it("healthy batch is success", () => {
    expect(batchStatus(500, iso(365)).tone).toBe("success");
  });
});

describe("childCoverage (empty-vs-zero rule)", () => {
  const today = "2026-07-24";
  it("is null when nothing is due yet (newborn)", () => {
    const rate = childCoverage([{ child_id: "a", status: "pending", due_date: "2026-12-01" }], today);
    expect(rate("a")).toBeNull();
    expect(rate("unknown")).toBeNull();
  });
  it("is done ÷ due-to-date", () => {
    const rate = childCoverage(
      [
        { child_id: "b", status: "done", due_date: "2026-01-01" },
        { child_id: "b", status: "pending", due_date: "2026-02-01" },
      ],
      today,
    );
    expect(rate("b")).toBe(0.5);
  });
});

describe("filterRows", () => {
  const rows = [{ t: "MR টিকা" }, { t: "BCG" }];
  const key = (r: { t: string }) => r.t;
  it("empty query returns all", () => {
    expect(filterRows(rows, key, "  ")).toHaveLength(2);
  });
  it("case-insensitive substring", () => {
    expect(filterRows(rows, key, "bcg")).toEqual([{ t: "BCG" }]);
    expect(filterRows(rows, key, "টিকা")).toEqual([{ t: "MR টিকা" }]);
  });
  it("no match returns empty", () => {
    expect(filterRows(rows, key, "zzz")).toHaveLength(0);
  });
});

describe("auditLabel", () => {
  it("maps trigger action strings to Bengali", () => {
    expect(auditLabel("user_roles.update")).toBe("ভূমিকা পরিবর্তন");
    expect(auditLabel("inventories.insert")).toBe("মজুদ হালনাগাদ");
    expect(auditLabel("unknown.op")).toBe("unknown.op");
  });
});

// D4-lite smoke: every sidebar destination resolves to a real page module. The full
// "login → visit all 9 → one write" E2E (needs a live server + auth) is deferred; this
// asserts the navigable-surface half of it without standing up Supabase.
describe("admin destinations exist", () => {
  const DESTINATIONS = [
    "",
    "children",
    "inventory",
    "catalog",
    "reports",
    "users",
    "audit",
    "notifications",
    "settings",
  ];
  it.each(DESTINATIONS)("/admin/%s has a page", (seg) => {
    const p = join(TEST_DIR, "..", "src", "app", "(admin)", "admin", seg, "page.tsx");
    expect(existsSync(p)).toBe(true);
  });
});
