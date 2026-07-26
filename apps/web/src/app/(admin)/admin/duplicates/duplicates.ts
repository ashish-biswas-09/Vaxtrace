// Candidate duplicate detection, as a pure function so it can be unit-tested without a
// database. It mirrors `children_dedup_idx` and `find_duplicate_children()` deliberately:
// the SQL side answers "is this new registration a duplicate of something?", one candidate at
// a time, at the moment a worker types. This answers the reviewer's question instead — "which
// pairs already in the register look like the same child?" — which is a different query shape
// and has no SQL equivalent that could be scoped as cheaply.
//
// The two must agree on what "the same" means, so the normalisation below is a transliteration
// of normalise_name(): casefold, replace every run of non-alphanumeric (Latin or Bengali)
// characters with a single space, trim. Crude on purpose. Phonetic and edit-distance matching
// is a research project; this catches spacing, honorifics and punctuation, which is what the
// overwhelming majority of real duplicates differ by.

export type DupChild = {
  id: string;
  child_id: string;
  full_name: string;
  date_of_birth: string;
  guardian_id: string;
  guardian_name: string;
  guardian_phone: string;
  created_at: string;
  birth_registration_no: string | null;
  doses: number;
};

export type DupGroup = {
  key: string;
  reason: string;
  confidence: "exact" | "high" | "possible";
  children: DupChild[];
};

// `\p{M}` is load-bearing and is the bug this function had until a test caught it.
//
// Bengali vowel signs — the ি in রহিমা, the া in খাতুন — are Unicode *marks*, not letters, so
// `[^\p{L}\p{N}]` deleted them and "রহিমা খাতুন" normalised to "রহ ম খ ত ন". Every Bengali name
// collapsed to its consonant skeleton, which matched far too much: রহিমা and রহমা became the
// same person. The SQL side never had the bug because its class is the whole Bengali block
// (`ঀ-৿`), marks included. Adding \p{M} makes the two agree again, which is the property that
// matters — a duplicate check that disagrees with the one at registration is worse than none.
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

export function findDuplicateGroups(children: DupChild[]): DupGroup[] {
  const groups = new Map<string, DupGroup>();

  const add = (
    key: string,
    reason: string,
    confidence: DupGroup["confidence"],
    child: DupChild,
  ) => {
    const existing = groups.get(key);
    if (existing) {
      if (!existing.children.some((c) => c.id === child.id)) existing.children.push(child);
      return;
    }
    groups.set(key, { key, reason, confidence, children: [child] });
  };

  for (const c of children) {
    // A birth registration number is a government identifier, so a collision is not a
    // resemblance — it is the same child, and the unique index on the column means this only
    // ever fires across a soft-deleted or already-merged row.
    if (c.birth_registration_no) {
      add(`brn:${c.birth_registration_no}`, "জন্ম নিবন্ধন নম্বর অভিন্ন", "exact", c);
    }
    add(
      `name:${normaliseName(c.full_name)}|${c.date_of_birth}`,
      "নাম ও জন্মতারিখ অভিন্ন",
      "high",
      c,
    );
    add(
      `phone:${c.guardian_phone}|${c.date_of_birth}`,
      "একই অভিভাবকের ফোন ও একই জন্মতারিখ",
      "possible",
      c,
    );
  }

  const multi = [...groups.values()].filter((g) => g.children.length > 1);

  // A pair matching on name+DOB also matches on phone+DOB, and showing the same two children
  // twice makes a reviewer distrust the queue. Keep the strongest signal per set of children.
  const bySignature = new Map<string, DupGroup>();
  const rank = { exact: 0, high: 1, possible: 2 } as const;
  for (const g of multi) {
    const signature = g.children
      .map((c) => c.id)
      .sort()
      .join(",");
    const seen = bySignature.get(signature);
    if (!seen || rank[g.confidence] < rank[seen.confidence]) bySignature.set(signature, g);
  }

  return [...bySignature.values()].sort(
    (a, b) =>
      rank[a.confidence] - rank[b.confidence] || b.children.length - a.children.length,
  );
}

// Which record should survive a merge. Not a preference — a rule, so that two reviewers
// looking at the same pair suggest the same winner:
//
//   1. the one with more recorded doses (merging into the emptier record moves more history,
//      and every move is a row that can go wrong),
//   2. then the one registered first, because that is the identifier most likely to be on a
//      card in the family's hands.
//
// It is a suggestion in the UI, not an enforced choice: the reviewer can see both records and
// this function cannot.
export function suggestWinner(children: DupChild[]): DupChild {
  return [...children].sort(
    (a, b) => b.doses - a.doses || a.created_at.localeCompare(b.created_at),
  )[0];
}
