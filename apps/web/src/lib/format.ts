// Bengali numeral formatting. Memory/§4.16: all digits render in Bengali script (০-৯),
// not ASCII, on every built screen.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toBn(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
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

// Whole days between today and an ISO date (negative = already past).
export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
