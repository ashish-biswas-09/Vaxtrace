"use client";

import { useMemo, useState } from "react";
import { LEVEL_LABEL_BN, type LocationNode } from "@/lib/locations";

const field =
  "mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

// One flat <select> holding the whole country was unusable: 160+ options today and ~5,000 once
// the official reference list lands, with the level carried only by leading spaces. A registrar
// picks an area the way the hierarchy is actually organised — বিভাগ → জেলা → উপজেলা →
// ইউনিয়ন/পৌরসভা → ওয়ার্ড — so the control is one select per level, each populated from the
// selection above it.
//
// The submitted value is the DEEPEST selection, which is what `location_id` has always meant.
// Stopping early is allowed and sometimes correct: not every branch is seeded to ward depth,
// and a child whose ward is unknown belongs at their union rather than nowhere.
export function AreaCascade({
  nodes,
  defaultId,
  name = "location_id",
  required = true,
}: {
  nodes: LocationNode[];
  defaultId?: string | null;
  name?: string;
  required?: boolean;
}) {
  const { byId, childrenOf, roots } = useMemo(() => {
    const byId = new Map<string, LocationNode>();
    const childrenOf = new Map<string | null, LocationNode[]>();
    for (const n of nodes) byId.set(n.id, n);
    for (const n of [...nodes].sort((a, b) => a.path.localeCompare(b.path))) {
      const key = n.parent_id;
      const list = childrenOf.get(key) ?? [];
      list.push(n);
      childrenOf.set(key, list);
    }
    // The country root is on every trail and tells the reader nothing, so the first select
    // offers divisions. If the tree is ever rooted differently, fall back to the real roots.
    const top = childrenOf.get(null) ?? [];
    const roots = top.length === 1 ? (childrenOf.get(top[0].id) ?? top) : top;
    return { byId, childrenOf, roots };
  }, [nodes]);

  // The chain of chosen ids, deepest last. Seeded from defaultId by walking up its ancestors,
  // so a registrar whose posting is a ward opens the form with every level already correct.
  const [chain, setChain] = useState<string[]>(() => {
    if (!defaultId || !byId.has(defaultId)) return [];
    const up: string[] = [];
    for (let cur = byId.get(defaultId); cur; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) {
      up.unshift(cur.id);
      if (!cur.parent_id) break;
    }
    // Drop the country root — it is not one of the selects.
    return roots.some((r) => r.id === up[0]) ? up : up.slice(1);
  });

  // One select per level: the roots, then the children of each selection, stopping at a leaf.
  const levels: { options: LocationNode[]; value: string }[] = [];
  let options = roots;
  for (let i = 0; options.length > 0; i++) {
    const value = chain[i] ?? "";
    levels.push({ options, value });
    if (!value) break;
    options = childrenOf.get(value) ?? [];
  }

  const selected = chain.length > 0 ? chain[chain.length - 1] : "";

  return (
    <div className="flex flex-col gap-3">
      {/* The form still submits a single location_id — the cascade is a way of choosing it,
          not a change to what a child's location means. */}
      <input type="hidden" name={name} value={selected} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {levels.map((lvl, i) => (
          <label key={i} className="text-xs text-[var(--color-muted)]">
            {LEVEL_LABEL_BN[lvl.options[0].level]}
            <select
              value={lvl.value}
              aria-label={LEVEL_LABEL_BN[lvl.options[0].level]}
              // Only the first level is required: the deeper ones may legitimately not exist
              // for a branch, and the browser must not block a submit on an empty one.
              required={required && i === 0}
              onChange={(e) => setChain([...chain.slice(0, i), e.target.value].filter(Boolean))}
              className={field}
            >
              <option value="">নির্বাচন করুন</option>
              {lvl.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name_bn}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
