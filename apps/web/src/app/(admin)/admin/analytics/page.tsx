import { redirect } from "next/navigation";

// Analytics merged into Reports (audit C4). Kept as a redirect so any existing bookmark/link
// still lands somewhere sensible instead of 404ing.
export default function AnalyticsPage() {
  redirect("/admin/reports");
}
