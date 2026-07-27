import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
import { batchStatus } from "@/app/(admin)/admin/inventory/status";
import { childCoverage } from "@/app/(admin)/admin/children/coverage";
import { filterRows } from "@/components/ui/DataTable";
import { auditLabel } from "@/app/(admin)/admin/_audit";

import { buildHistory, doseStatus, summarise } from "@/app/(admin)/admin/children/[id]/history";
import { USER_STATUS, userStatus } from "@/app/(admin)/admin/users/_status";
import { NOTIF_STATUS } from "@/app/(admin)/admin/notifications/status";

// Local calendar date offset by N days — must match daysUntil()'s notion of "today", which
// is local, not UTC.
const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

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

describe("filterRows digit normalisation", () => {
  const rows = [{ t: "1000000008 আয়েশা" }];
  const key = (r: { t: string }) => r.t;
  it("a Bengali-digit query matches an ASCII-digit Child ID", () => {
    expect(filterRows(rows, key, "১০০০০০০০০৮")).toHaveLength(1);
  });
  it("an ASCII query still matches", () => {
    expect(filterRows(rows, key, "1000000008")).toHaveLength(1);
  });
});

describe("auditLabel", () => {
  it("maps trigger action strings to Bengali", () => {
    expect(auditLabel("user_roles.update")).toBe("ভূমিকা পরিবর্তন");
    expect(auditLabel("inventories.insert")).toBe("মজুদ হালনাগাদ");
    expect(auditLabel("unknown.op")).toBe("unknown.op");
  });
  it("separates a dose amendment from a dose being given", () => {
    expect(auditLabel("vaccination_records.insert")).toBe("ডোজ প্রদান");
    expect(auditLabel("dose.record")).toBe("ডোজ প্রদান");
    expect(auditLabel("vaccination_records.update")).toBe("ডোজ রেকর্ড সংশোধন");
  });
});

describe("buildHistory (child vaccination record)", () => {
  const today = "2026-07-25";
  const sched = (dose: number, due: string, status = "pending") => ({
    vaccine_id: "v1",
    dose_number: dose,
    due_date: due,
    status,
  });
  const rec = (dose: number, date: string) => ({
    id: `r${dose}`,
    vaccine_id: "v1",
    dose_number: dose,
    administered_date: date,
    administered_by: "w1",
    batch_number: null,
    notes: null,
    adverse_event: null,
  });

  it("shows scheduled doses that were never given, not just administered ones", () => {
    const rows = buildHistory([sched(1, "2026-01-01"), sched(2, "2026-12-01")], [rec(1, "2026-01-03")], today);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.status)).toEqual(["done", "upcoming"]);
  });

  it("splits pending into due (past) and upcoming (future)", () => {
    expect(doseStatus(sched(1, "2026-07-01"), false, today)).toBe("due");
    expect(doseStatus(sched(1, "2026-08-01"), false, today)).toBe("upcoming");
    expect(doseStatus(sched(1, "2026-01-01", "missed"), false, today)).toBe("missed");
  });

  it("keeps a record whose schedule row is gone (vaccine deactivated)", () => {
    const rows = buildHistory([], [rec(3, "2026-05-05")], today);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "done", due_date: null });
  });

  it("orders by when it happened, else when it was due", () => {
    const rows = buildHistory(
      [sched(1, "2026-06-01"), sched(2, "2026-02-01")],
      [rec(1, "2026-01-15")],
      today,
    );
    expect(rows.map((r) => r.dose_number)).toEqual([1, 2]);
  });

  it("summarise reports null coverage when nothing is due yet", () => {
    const newborn = buildHistory([sched(1, "2026-12-01")], [], today);
    expect(summarise(newborn).coverage).toBeNull();

    const half = buildHistory([sched(1, "2026-01-01"), sched(2, "2026-02-01")], [rec(1, "2026-01-02")], today);
    expect(summarise(half).coverage).toBe(0.5);
  });
});

// D4-lite smoke: every sidebar destination resolves to a real page module. The full
// "login → visit all 9 → one write" E2E (needs a live server + auth) is deferred; this
// asserts the navigable-surface half of it without standing up Supabase.
describe("admin destinations exist", () => {
  const DESTINATIONS = [
    "",
    "children",
    "children/[id]",
    "inventory",
    "inventory/new",
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

  it("account management exists outside the admin shell, so every role can reach it", () => {
    const p = join(TEST_DIR, "..", "src", "app", "(account)", "account", "page.tsx");
    expect(existsSync(p)).toBe(true);
  });

  // Registration is the only way a child (and therefore a Child ID and a schedule) enters
  // the system, so both shells that can do it must keep their route.
  it.each([
    ["(worker)", "worker", "children/new"],
    ["(admin)", "admin", "children/new"],
  ])("%s/%s/%s has a page", (group, role, seg) => {
    expect(existsSync(join(TEST_DIR, "..", "src", "app", group, role, seg, "page.tsx"))).toBe(true);
  });
});

describe("user status registry", () => {
  it("covers exactly the user_status enum, so no DB value renders as a raw string", () => {
    expect(Object.keys(USER_STATUS).sort()).toEqual(["active", "inactive", "invited"]);
  });
  it("falls back readably for an unknown value", () => {
    expect(userStatus("active").label).toBe("সক্রিয়");
    expect(userStatus("gibberish").label).toBe("gibberish");
  });
});

describe("notification status registry", () => {
  it("covers exactly the notification_status enum", () => {
    expect(Object.keys(NOTIF_STATUS).sort()).toEqual(["dead", "failed", "queued", "sent"]);
  });
});
