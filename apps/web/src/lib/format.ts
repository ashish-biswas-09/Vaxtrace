// Bengali numeral formatting. Memory/§4.16: all digits render in Bengali script (০-৯),
// not ASCII, on every built screen.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toBn(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

// The inverse. IDs (Child ID, batch numbers) are *displayed* in Bengali digits like every
// other numeral, but they are also *typed* — into a search box, off a printed card, over the
// phone. Normalising the query means either script matches, so nobody has to know which one
// the database stores.
export function fromBn(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

// A 0..1 rate as a Bengali percentage, e.g. 0.583 -> "৫৮%". Null-safe for empty views.
export function pctBn(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${toBn(Math.round(rate * 100))}%`;
}

// ISO date (yyyy-mm-dd) -> Bengali-digit dd/mm/yyyy.
export function dateBn(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return toBn(`${d}/${m}/${y}`);
}

// A timestamp as Bengali dd/mm/yyyy hh:mm. dateBn alone drops the time, which is fine for a
// due date but wrong for an activity feed: eight audit entries from the same day all rendered
// as the same string, so the feed looked unordered and told you nothing about recency.
export function dateTimeBn(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return toBn(
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
  );
}

// Age from date-of-birth in Bengali: infants in months ("৮ মাস"), ≥1yr in years ("৩ বছর").
// Matches the Parent screens' single-unit convention (see vaxtrace-figma-ui).
export function ageBn(dob: string | null | undefined): string {
  if (!dob) return "—";
  const b = new Date(dob);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) months = 0;
  return months < 12 ? `${toBn(months)} মাস` : `${toBn(Math.floor(months / 12))} বছর`;
}

// Today's *local* calendar date as yyyy-mm-dd.
//
// Deliberately not `new Date().toISOString().slice(0,10)`, which yields the UTC date: in
// Bangladesh (UTC+6) that is still yesterday until 06:00 every morning. Comparing a due_date
// against it made every dose due today read as "upcoming", and every batch expiring today
// read as already expired, for the first six hours of the day.
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Whole days between today and an ISO date (negative = already past).
export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // `new Date("2026-07-25")` parses as UTC midnight, so setHours() then snaps it to the
  // local day that instant falls in — a day early east of Greenwich. Constructing from the
  // parts keeps the date on the calendar the user is actually looking at.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
