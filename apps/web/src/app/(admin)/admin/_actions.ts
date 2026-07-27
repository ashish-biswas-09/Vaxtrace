"use server";

import { createClient } from "@/server/supabase/server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { fromBn } from "@/lib/format";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export type ChildHit = { id: string; child_id: string; full_name: string };

// Backs the command palette's child lookup. Numerals are normalised to ASCII before the query
// because IDs render in Bengali digits everywhere but get typed in whichever script the
// keyboard happens to be in — "১০০০০০০০০৮" and "1000000008" have to find the same child.
//
// RLS still decides what comes back; this only shapes the query.
export async function searchChildrenAction(query: string): Promise<ChildHit[]> {
  // PostgREST's `or=` is a comma-separated grammar with `.`, `(`, `)` and `*` as operators, so
  // raw input would let a search box rewrite the filter. Keep letters, digits (either script)
  // and spaces; everything else is dropped rather than escaped.
  const q = fromBn(query)
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .slice(0, 64);
  if (q.length < 2) return [];

  const supabase = await requireRole("admin");
  const { data } = await supabase
    .from("children")
    .select("id, child_id, full_name")
    .or(`full_name.ilike.%${q}%,child_id.ilike.%${q}%`)
    .limit(8);

  return data ?? [];
}
