// One registry for notification statuses and channels. Extracted from the page so the queue
// KPI cards, the delivery-log pills and any future worker-facing view read the same labels —
// the cross-role terminology drift the UI audit flagged happens when each screen writes its
// own map.
export type NotifTone = "muted" | "success" | "warning" | "danger";

export const NOTIF_STATUS: Record<string, { label: string; tone: NotifTone }> = {
  queued: { label: "সারিবদ্ধ", tone: "muted" },
  sent: { label: "পাঠানো", tone: "success" },
  failed: { label: "ব্যর্থ", tone: "warning" },
  dead: { label: "বাতিল", tone: "danger" },
};

export const NOTIF_CHANNEL: Record<string, string> = { sms: "SMS", email: "ইমেইল" };

export function notifStatus(status: string) {
  return NOTIF_STATUS[status] ?? { label: status, tone: "muted" as NotifTone };
}
