import { z } from "zod";

// The Coverage screen is a function of its URL, which makes the URL a trust boundary: every
// value in it reaches an RPC. Anything malformed falls back to its default and sets `invalid`,
// so the screen says so in Bengali instead of printing a Postgres error (K-07, K-14).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LTREE = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;

const isRealDate = (s: string) => ISO_DATE.test(s) && !Number.isNaN(Date.parse(s));

export type CoverageParams = {
  area: string | null;
  vaccine: string | null; // null = the default antigen, "all" = every antigen
  year: number;
  from: string | null;
  to: string | null;
  invalid: boolean;
};

export function parseCoverageParams(
  sp: Record<string, string | undefined>,
  currentYear: number,
): CoverageParams {
  let invalid = false;
  const pick = <T>(raw: string | undefined, ok: boolean, value: T, fallback: T): T => {
    if (!raw) return fallback;
    if (!ok) invalid = true;
    return ok ? value : fallback;
  };

  const area = pick(sp.area, LTREE.test(sp.area ?? ""), sp.area ?? null, null);
  const vaccine = pick(
    sp.vaccine,
    sp.vaccine === "all" || z.string().uuid().safeParse(sp.vaccine).success,
    sp.vaccine ?? null,
    null,
  );
  const yearNum = Number(sp.year);
  const year = pick(
    sp.year,
    Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100,
    yearNum,
    currentYear,
  );
  let from = pick(sp.from, isRealDate(sp.from ?? ""), sp.from ?? null, null);
  let to = pick(sp.to, isRealDate(sp.to ?? ""), sp.to ?? null, null);
  if (from && to && from > to) {
    invalid = true;
    from = null;
    to = null;
  }

  return { area, vaccine, year, from, to, invalid };
}
