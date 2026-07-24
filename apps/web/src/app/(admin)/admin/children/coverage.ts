export type Sched = { child_id: string; status: string; due_date: string };

// Per-child coverage = doses done ÷ doses due-to-date. Returns null when nothing is due yet
// (a newborn) so the UI shows "—" rather than a misleading 0%. Extracted from the page so the
// empty-vs-zero rule (audit blind-spot #8) has a unit test.
export function childCoverage(
  schedules: Sched[],
  today: string,
): (childId: string) => number | null {
  const cov = new Map<string, { due: number; done: number }>();
  for (const s of schedules) {
    const c = cov.get(s.child_id) ?? { due: 0, done: 0 };
    if (s.status === "done") c.done += 1;
    if (s.due_date <= today) c.due += 1;
    cov.set(s.child_id, c);
  }
  return (id) => {
    const c = cov.get(id);
    return c && c.due > 0 ? c.done / c.due : null;
  };
}
