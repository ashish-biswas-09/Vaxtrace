// PostgREST caps every response at `max_rows` (1000, see supabase/config.toml) and does it
// SILENTLY — no error, no flag, just a short array. Any screen that reads a whole table to
// aggregate it in JS is therefore correct only while that table is small, and then quietly
// starts reporting numbers that are too low. The children list hit this at 5,320 schedule
// rows: every child past the first ~70 showed coverage "—" because their schedule rows were
// never returned.
//
// ponytail: this pages the rows into the app instead of aggregating in the database, which is
// the real fix. Move the aggregate into a view or an RPC when a single screen's page count
// stops being a handful of round trips.

const PAGE = 1000;

type PagedQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

/** Reads every row of a query, page by page, instead of silently stopping at the row cap. */
export async function selectAll<T>(build: () => PagedQuery<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}
