// A child's immunisation record is the *schedule* joined to the *doses actually given* —
// not one or the other. Showing only administered doses hides what was missed, which is the
// single thing a program officer opens this screen to find out. So every scheduled dose
// appears, carrying its record when one exists.
//
// Pure so the merge rules (status precedence, ordering, orphan records) have a unit test.

export type SchedRow = {
  vaccine_id: string;
  dose_number: number;
  due_date: string;
  status: string;
};

export type RecordRow = {
  id: string;
  vaccine_id: string;
  dose_number: number;
  administered_date: string;
  administered_by: string;
  batch_number: string | null;
  notes: string | null;
  adverse_event: string | null;
};

export type DoseStatus = "done" | "due" | "upcoming" | "missed";

export type HistoryRow = {
  key: string;
  vaccine_id: string;
  dose_number: number;
  due_date: string | null;
  status: DoseStatus;
  record: RecordRow | null;
};

const key = (vaccineId: string, dose: number) => `${vaccineId}:${dose}`;

// `schedules.status` only knows pending/done/missed — the nightly sweep flips a dose to
// `missed` 14 days after it was due. Between "due today" and "swept" the row is still
// `pending`, so the UI needs a third reading: pending-and-past = due, pending-and-future =
// upcoming. Without that split every newborn's whole future calendar reads as outstanding.
export function doseStatus(sched: SchedRow, hasRecord: boolean, today: string): DoseStatus {
  if (hasRecord || sched.status === "done") return "done";
  if (sched.status === "missed") return "missed";
  return sched.due_date <= today ? "due" : "upcoming";
}

export function buildHistory(
  schedules: SchedRow[],
  records: RecordRow[],
  today: string,
): HistoryRow[] {
  const recordByDose = new Map(records.map((r) => [key(r.vaccine_id, r.dose_number), r]));
  const seen = new Set<string>();

  const rows: HistoryRow[] = schedules.map((s) => {
    const k = key(s.vaccine_id, s.dose_number);
    seen.add(k);
    const record = recordByDose.get(k) ?? null;
    return {
      key: k,
      vaccine_id: s.vaccine_id,
      dose_number: s.dose_number,
      due_date: s.due_date,
      status: doseStatus(s, record != null, today),
      record,
    };
  });

  // A dose given for a vaccine that was later deactivated has a record but no schedule row.
  // Dropping it would silently erase an administered dose from a medical history.
  for (const r of records) {
    const k = key(r.vaccine_id, r.dose_number);
    if (seen.has(k)) continue;
    rows.push({
      key: k,
      vaccine_id: r.vaccine_id,
      dose_number: r.dose_number,
      due_date: null,
      status: "done",
      record: r,
    });
  }

  // Chronological: when it happened if it happened, otherwise when it should.
  return rows.sort((a, b) => {
    const da = a.record?.administered_date ?? a.due_date ?? "";
    const db = b.record?.administered_date ?? b.due_date ?? "";
    return da === db ? a.dose_number - b.dose_number : da.localeCompare(db);
  });
}

export function summarise(rows: HistoryRow[]) {
  const done = rows.filter((r) => r.status === "done").length;
  const due = rows.filter((r) => r.status === "due").length;
  const missed = rows.filter((r) => r.status === "missed").length;
  const upcoming = rows.filter((r) => r.status === "upcoming").length;
  const expected = done + due + missed; // doses that should already have happened
  return {
    done,
    due,
    missed,
    upcoming,
    total: rows.length,
    // null, not 0, when nothing is due yet — a newborn has no coverage, not zero coverage.
    coverage: expected > 0 ? done / expected : null,
  };
}
