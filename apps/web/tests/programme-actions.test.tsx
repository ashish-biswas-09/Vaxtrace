// Server-action tests for the কর্মসূচি audit (K-06, K-16, K-17, S-5, S-6) against a recorded
// fake Supabase client — the save paths, without writing to any database.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { method: string; args: unknown[] };
type Handler = (table: string, calls: Call[]) => { data?: unknown; error?: unknown };

let handler: Handler = () => ({ data: null, error: null });
const writes: { table: string; calls: Call[] }[] = [];

// Every query-builder method records itself and returns the builder; awaiting it (or
// .maybeSingle()) resolves through `handler`, which sees the table and the whole chain.
function builder(table: string) {
  const calls: Call[] = [];
  const resolve = () => {
    if (calls.some((c) => ["update", "insert"].includes(c.method))) writes.push({ table, calls });
    return Promise.resolve({ data: null, error: null, ...handler(table, calls) });
  };
  const b: Record<string, unknown> = {
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => resolve().then(ok, bad),
    maybeSingle: () => resolve(),
  };
  for (const m of ["select", "update", "insert", "eq", "is", "in", "order", "gte", "lt"]) {
    b[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return b;
    };
  }
  return b;
}

const supabase = {
  from: (t: string) => builder(t),
  rpc: vi.fn(),
  auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } }) },
};

vi.mock("@/lib/auth", () => ({ requireAppRole: async () => ({ supabase, claims: {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/format", async (orig) => ({
  ...(await orig<typeof import("@/lib/format")>()),
  todayIso: () => "2026-09-29",
}));

import { cancelSessionAction, planSessionAction } from "@/app/(admin)/admin/sessions/_actions";
import { classifyCaseAction } from "@/app/(admin)/admin/aefi/_actions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const updateOf = (table: string) =>
  writes.find((w) => w.table === table)?.calls.find((c) => c.method === "update")?.args[0] as
    | Record<string, unknown>
    | undefined;

const ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  writes.length = 0;
  handler = () => ({ data: null, error: null });
});

describe("cancelSessionAction (K-06)", () => {
  it("reports failure when the update touched no row (RLS-filtered or no longer planned)", async () => {
    handler = () => ({ data: [], error: null });
    const r = await cancelSessionAction(undefined, form({ session_id: ID, cancel_reason: "বন্যা" }));
    expect(r?.ok).toBeUndefined();
    expect(r?.error).toContain("বাতিল করা যায়নি");
  });
  it("reports success only when a row came back", async () => {
    handler = () => ({ data: [{ id: ID }], error: null });
    const r = await cancelSessionAction(undefined, form({ session_id: ID, cancel_reason: "বন্যা" }));
    expect(r?.ok).toBe("সেশন বাতিল হয়েছে।");
  });
  it("requires a reason of at least 3 characters before touching the database", async () => {
    const r = await cancelSessionAction(undefined, form({ session_id: ID, cancel_reason: "ab" }));
    expect(r?.error).toBeDefined();
    expect(writes).toHaveLength(0);
  });
});

describe("planSessionAction (K-17)", () => {
  const FAC = "33333333-3333-4333-8333-333333333333";
  const loc = (id: string, path: string, level: string) => ({ id, path, level, name_bn: path, name_en: path, parent_id: null });
  const UPZ = "44444444-4444-4444-8444-444444444444";
  const WARD = "55555555-5555-4555-8555-555555555555";
  const DIST = "66666666-6666-4666-8666-666666666666";
  const OTHER = "77777777-7777-4777-8777-777777777777";
  beforeEach(() => {
    handler = (table) =>
      table === "facilities"
        ? { data: { id: FAC, location_id: UPZ } }
        : table === "locations"
          ? {
              data: [
                loc(DIST, "bd.dhaka.gazipur", "district"),
                loc(UPZ, "bd.dhaka.gazipur.sreepur", "upazila"),
                loc(WARD, "bd.dhaka.gazipur.sreepur.barmi.ward_1", "ward"),
                loc(OTHER, "bd.dhaka.gazipur.kaliakair.mouchak.ward_1", "ward"),
              ],
            }
          : { data: null, error: null };
  });
  const plan = (o: Record<string, string>) =>
    planSessionAction(undefined, form({ facility_id: FAC, type: "outreach", session_date: "2026-10-05", ...o }));

  it("refuses a date in the past even if the form's min was bypassed", async () => {
    const r = await plan({ location_id: WARD, session_date: "2026-09-01" });
    expect(r?.error).toBe("আজ বা পরের কোনো তারিখ দিন");
    expect(writes).toHaveLength(0);
  });
  it("refuses outreach at a district, or at a ward outside the facility's upazila", async () => {
    expect((await plan({ location_id: DIST }))?.error).toContain("ইউনিয়ন বা ওয়ার্ড");
    expect((await plan({ location_id: OTHER }))?.error).toContain("ইউনিয়ন বা ওয়ার্ড");
    expect(writes).toHaveLength(0);
  });
  it("refuses a fixed session away from the facility", async () => {
    const r = await plan({ type: "fixed", location_id: WARD });
    expect(r?.error).toContain("স্থায়ী কেন্দ্রের সেশন");
  });
  it("saves outreach at a ward inside the upazila", async () => {
    const r = await plan({ location_id: WARD });
    expect(r?.ok).toBeDefined();
    expect(writes.find((w) => w.table === "sessions")).toBeDefined();
  });
});

describe("classifyCaseAction (K-06, K-16, S-5, S-6)", () => {
  const base = { case_id: ID, status: "under_investigation", severity: "serious", outcome: "unknown" };
  const withCurrent = (current: Record<string, unknown>, updated: unknown[] = [{ id: ID }]) => {
    handler = (_t, calls) =>
      calls.some((c) => c.method === "update") ? { data: updated } : { data: current };
  };

  it("refuses to move a case backwards", async () => {
    withCurrent({ status: "classified", severity: "serious", investigated_by: null });
    const r = await classifyCaseAction(undefined, form({ ...base, status: "reported" }));
    expect(r?.error).toContain("সামনের ধাপে");
    expect(writes).toHaveLength(0);
  });
  it("requires a reason to lower severity, and stores it", async () => {
    withCurrent({ status: "reported", severity: "serious", investigated_by: null });
    expect((await classifyCaseAction(undefined, form({ ...base, severity: "minor" })))?.error).toContain("কারণ");
    const r = await classifyCaseAction(
      undefined,
      form({ ...base, severity: "minor", severity_change_reason: "বহির্বিভাগে চিকিৎসা" }),
    );
    expect(r?.ok).toBeDefined();
    expect(updateOf("aefi_cases")?.severity_change_reason).toBe("বহির্বিভাগে চিকিৎসা");
  });
  it("keeps the first investigator", async () => {
    withCurrent({ status: "reported", severity: "serious", investigated_by: "someone-else" });
    await classifyCaseAction(undefined, form(base));
    expect(updateOf("aefi_cases")).not.toHaveProperty("investigated_by");
  });
  it("reports failure when RLS filtered the update out", async () => {
    withCurrent({ status: "reported", severity: "serious", investigated_by: null }, []);
    const r = await classifyCaseAction(undefined, form(base));
    expect(r?.ok).toBeUndefined();
    expect(r?.error).toContain("অনুমতি আপনার নেই");
  });
  it("rejects a 1–2 character note before the database does", async () => {
    withCurrent({ status: "reported", severity: "serious", investigated_by: null });
    const r = await classifyCaseAction(undefined, form({ ...base, investigation_note: "ok" }));
    expect(r?.error).toContain("৩ অক্ষরের");
  });
});
