import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  APP_ROLE_LABEL_BN,
  APP_ROLE_RANK,
  APP_TO_USER_ROLE,
  GRANTABLE_ROLES,
  appRoleAtLeast,
  userRoleFor,
  type AppRole,
} from "@/lib/roles";
import { LEVEL_LABEL_BN, nlevel, pathTrail, toIndentedOptions } from "@/lib/locations";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(TEST_DIR, "../../../supabase/migrations");

const ALL_ROLES: AppRole[] = [
  "guardian",
  "field_worker",
  "store_keeper",
  "supervisor",
  "programme_manager",
  "system_admin",
];

// The TypeScript role tables are a *copy* of two SQL functions. A copy that drifts routes a
// user into the wrong shell or lets a screen offer a grant the database will refuse, and both
// failures are silent. These tests read the migration and assert the copy still matches, so
// the drift breaks CI instead of production.
describe("app_role mirrors the SQL", () => {
  const sql = readFileSync(join(MIGRATIONS, "20260726110000_geography_and_scope.sql"), "utf-8");

  it("declares exactly the six roles the enum declares", () => {
    const enumBody = sql.split("create type app_role as enum (")[1]?.split(");")[0] ?? "";
    const declared = [...enumBody.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual([...ALL_ROLES].sort());
  });

  it("ranks roles the same way app_role_rank does", () => {
    const body = sql.split("function public.app_role_rank")[1]?.split("$$")[1] ?? "";
    for (const role of ALL_ROLES) {
      const match = body.match(new RegExp(`when '${role}'\\s+then (\\d+)`));
      expect(match, `app_role_rank has no branch for ${role}`).toBeTruthy();
      expect(Number(match![1])).toBe(APP_ROLE_RANK[role]);
    }
  });

  it("maps to the legacy user_role the same way app_role_to_user_role does", () => {
    const body = sql.split("function public.app_role_to_user_role")[1]?.split("$$")[1] ?? "";
    for (const role of ALL_ROLES) {
      const match = body.match(new RegExp(`when '${role}'\\s+then '([a-z]+)'::user_role`));
      expect(match, `app_role_to_user_role has no branch for ${role}`).toBeTruthy();
      expect(match![1]).toBe(APP_TO_USER_ROLE[role]);
    }
  });
});

describe("appRoleAtLeast", () => {
  it("orders the ladder, and a missing role never satisfies a minimum", () => {
    expect(appRoleAtLeast("system_admin", "programme_manager")).toBe(true);
    expect(appRoleAtLeast("programme_manager", "programme_manager")).toBe(true);
    expect(appRoleAtLeast("supervisor", "programme_manager")).toBe(false);
    expect(appRoleAtLeast("guardian", "field_worker")).toBe(false);
    // The BUG-01 regression, in the direction the bug went: a multi-capacity user must not be
    // resolved down to their lowest role.
    expect(appRoleAtLeast("field_worker", "guardian")).toBe(true);
    expect(appRoleAtLeast(null, "guardian")).toBe(false);
  });

  it("routes every role to a shell", () => {
    for (const role of ALL_ROLES) {
      expect(["admin", "worker", "parent"]).toContain(userRoleFor(role));
      expect(APP_ROLE_LABEL_BN[role]).toBeTruthy();
    }
  });

  it("never offers guardian as a posting", () => {
    // A guardian's scope is ownership, not geography — a user_assignments row would say
    // otherwise, and the check constraint would demand a location for it.
    expect(GRANTABLE_ROLES).not.toContain("guardian");
    expect(GRANTABLE_ROLES).toHaveLength(5);
  });
});

describe("location paths", () => {
  const nodes = [
    { id: "1", name_bn: "বাংলাদেশ", name_en: "Bangladesh", level: "country" as const, path: "bd", parent_id: null },
    { id: "2", name_bn: "ঢাকা", name_en: "Dhaka", level: "division" as const, path: "bd.dhaka", parent_id: "1" },
    { id: "3", name_bn: "গাজীপুর", name_en: "Gazipur", level: "district" as const, path: "bd.dhaka.gazipur", parent_id: "2" },
    { id: "4", name_bn: "কালিয়াকৈর", name_en: "Kaliakair", level: "upazila" as const, path: "bd.dhaka.gazipur.kaliakair", parent_id: "3" },
  ];
  const byPath = new Map(nodes.map((n) => [n.path, n]));

  it("measures depth the way nlevel() does", () => {
    expect(nlevel("bd")).toBe(1);
    expect(nlevel("bd.dhaka.gazipur.kaliakair")).toBe(4);
  });

  it("renders a trail without the country root", () => {
    // The root is on every trail and tells the reader nothing.
    expect(pathTrail("bd.dhaka.gazipur.kaliakair", byPath)).toBe("ঢাকা › গাজীপুর › কালিয়াকৈর");
    expect(pathTrail("bd", byPath)).toBe("বাংলাদেশ");
  });

  it("falls back to the raw slug for a node it cannot see", () => {
    // A manager scoped to one district cannot read every location row; the trail must still
    // render rather than showing blanks.
    expect(pathTrail("bd.dhaka.unknown_upazila", byPath)).toBe("ঢাকা › unknown_upazila");
  });

  it("sorts a picker by path so subtrees stay together", () => {
    const options = toIndentedOptions([...nodes].reverse());
    expect(options.map((o) => o.depth)).toEqual([0, 1, 2, 3]);
    expect(options[3].label).toContain(LEVEL_LABEL_BN.upazila);
  });
});
