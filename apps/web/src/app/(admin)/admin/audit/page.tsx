import { redirect } from "next/navigation";

// The audit-log screen was removed from the admin panel. The trail itself is untouched — the
// triggers still write every change, Settings still reports that they are active, and the
// dashboard still shows recent activity. This keeps existing bookmarks off a 404, the same
// way the analytics route does.
export default function AuditPage() {
  redirect("/admin");
}
