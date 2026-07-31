// The date-window vocabulary, kept out of DateScope.tsx because that file is a "use client"
// module: a server component importing `rangeDays` from it gets a client reference rather
// than the function, and Next throws "attempted to call rangeDays() from the server".
// Constants and a pure helper belong in a module neither side has to own.

export const RANGES = [
  { value: "7", label: "গত ৭ দিন", days: 7 },
  { value: "30", label: "গত ৩০ দিন", days: 30 },
  { value: "90", label: "গত ৯০ দিন", days: 90 },
  { value: "365", label: "গত ১ বছর", days: 365 },
] as const;

export const DEFAULT_RANGE = "30";

/** Days for a `range` search param, clamped to the allowed set. */
export function rangeDays(value: string | undefined): number {
  return RANGES.find((r) => r.value === value)?.days ?? 30;
}
