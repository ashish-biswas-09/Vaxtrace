// Bengali label for an audit action. Raw actions come from the trg_admin_audit trigger as
// `<table>.<op>` (e.g. "user_roles.update") plus the domain-logic action strings
// (e.g. "dose.record"). Shared by the dashboard activity widget, the audit-log screen, the
// audit CSV export and the account-activity list, so none of them can drift.
//
// Ordered most-specific first: "vaccination_records.update" is an amendment — a remark or an
// adverse event added after the fact — not the administration of a dose. Collapsing the two
// would hide exactly the correction an auditor came looking for.
export function auditLabel(action: string): string {
  if (action.startsWith("vaccination_records.update")) return "ডোজ রেকর্ড সংশোধন";
  if (action.startsWith("dose") || action.startsWith("vaccination_records")) return "ডোজ প্রদান";
  if (action.startsWith("children")) return "শিশু নিবন্ধন ও পরিবর্তন";
  if (action.startsWith("profiles")) return "প্রোফাইল পরিবর্তন";
  if (action.startsWith("inventories")) return "মজুদ হালনাগাদ";
  if (action.startsWith("vaccine_doses")) return "ডোজ সূচি পরিবর্তন";
  if (action.startsWith("vaccines")) return "টিকা তালিকা পরিবর্তন";
  if (action.startsWith("user_roles")) return "ভূমিকা পরিবর্তন";
  return action;
}
