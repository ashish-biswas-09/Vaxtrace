import { daysUntil } from "@/lib/format";

export type BatchTone = "success" | "warning" | "danger";

// A batch's headline status: expiry first (a near-expiry batch matters even if well-stocked),
// then low stock. Thresholds match the dashboard KPI (≤50 units) and demo seed (11/18-day batches).
export function batchStatus(stockQuantity: number, expiryDate: string): {
  tone: BatchTone;
  label: string;
} {
  const days = daysUntil(expiryDate);
  if (days < 0) return { tone: "danger", label: "মেয়াদোত্তীর্ণ" };
  if (stockQuantity === 0) return { tone: "danger", label: "মজুদ শেষ" };
  if (days <= 30) return { tone: "warning", label: "মেয়াদ ঘনিয়ে" };
  if (stockQuantity <= 50) return { tone: "warning", label: "স্বল্প মজুদ" };
  return { tone: "success", label: "স্বাভাবিক" };
}
