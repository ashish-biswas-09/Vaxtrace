// Bengali label for an audit action. Raw actions come from the trg_admin_audit trigger as
// `<table>.<op>` (e.g. "user_roles.update") plus the domain-logic action strings.
// Shared by the dashboard activity widget and the full audit-log screen so they can't drift.
export function auditLabel(action: string): string {
  if (action.startsWith("inventories")) return "মজুদ হালনাগাদ";
  if (action.startsWith("vaccine_doses")) return "ডোজ সূচি পরিবর্তন";
  if (action.startsWith("vaccines")) return "টিকা তালিকা পরিবর্তন";
  if (action.startsWith("user_roles")) return "ভূমিকা পরিবর্তন";
  if (action.startsWith("dose") || action.startsWith("vaccination_records")) return "ডোজ প্রদান";
  return action;
}
