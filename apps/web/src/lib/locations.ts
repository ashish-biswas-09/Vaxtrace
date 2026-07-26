import type { Database } from "@vaxtrace/db-types";

export type LocationLevel = Database["public"]["Enums"]["location_level"];

export const LEVEL_LABEL_BN: Record<LocationLevel, string> = {
  country: "দেশ",
  division: "বিভাগ",
  district: "জেলা",
  upazila: "উপজেলা",
  city_corporation: "সিটি কর্পোরেশন",
  union: "ইউনিয়ন",
  urban_ward: "শহর ওয়ার্ড",
  ward: "ওয়ার্ড",
  village: "গ্রাম",
  mahalla: "মহল্লা",
};

export const FACILITY_TYPE_LABEL_BN: Record<
  Database["public"]["Enums"]["facility_type"],
  string
> = {
  upazila_health_complex: "উপজেলা স্বাস্থ্য কমপ্লেক্স",
  union_health_centre: "ইউনিয়ন স্বাস্থ্য কেন্দ্র",
  community_clinic: "কমিউনিটি ক্লিনিক",
  city_corporation_centre: "সিটি কর্পোরেশন কেন্দ্র",
  ngo_clinic: "এনজিও ক্লিনিক",
  outreach_site: "আউটরিচ কেন্দ্র",
  hospital: "হাসপাতাল",
};

export type LocationNode = {
  id: string;
  name_bn: string;
  name_en: string;
  level: LocationLevel;
  path: string;
  parent_id: string | null;
};

// Depth of an ltree path: 'bd.dhaka.gazipur' -> 3. Mirrors nlevel() in SQL, which is what the
// child-location trigger orders by when it picks a registrar's most specific posting.
export function nlevel(path: string): number {
  return path.split(".").length;
}

// A picker needs the hierarchy readable at a glance, and the hierarchy is already encoded in
// the path — so ordering by path and indenting by depth gives a correct tree without building
// one. Sorting by path also puts every subtree together, which a name sort would not.
export function toIndentedOptions(
  nodes: LocationNode[],
): { id: string; label: string; depth: number }[] {
  return [...nodes]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((n) => ({
      id: n.id,
      depth: nlevel(n.path) - 1,
      label: `${n.name_bn} · ${LEVEL_LABEL_BN[n.level]}`,
    }));
}

// The human-readable trail for a path, resolved against a map of every location the caller
// can see. Falls back to the raw slug for anything missing, so a partially-loaded tree
// degrades to something still readable rather than to blanks.
export function pathTrail(path: string, byPath: Map<string, LocationNode>): string {
  const parts = path.split(".");
  const trail: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.slice(0, i + 1).join(".");
    trail.push(byPath.get(prefix)?.name_bn ?? parts[i]);
  }
  // The country root is on every trail and tells the reader nothing.
  return trail.slice(1).join(" › ") || trail[0];
}
