// Account status registry, shared by the users table, the invite dialog and the status
// control so the three cannot describe the same state differently.
//
// The lifecycle is enforced, not decorative: the access token hook stamps `user_status` onto
// the JWT and `auth_role()` returns NULL for anything other than 'active', so every
// role-based RLS policy denies a suspended account system-wide.
export type StatusTone = "success" | "warning" | "muted";

export const USER_STATUS: Record<string, { label: string; tone: StatusTone; hint: string }> = {
  active: { label: "সক্রিয়", tone: "success", hint: "স্বাভাবিকভাবে প্রবেশ করতে পারে" },
  invited: {
    label: "আমন্ত্রিত",
    tone: "warning",
    hint: "আমন্ত্রণ পাঠানো হয়েছে, এখনো প্রথম লগইন করেনি",
  },
  inactive: { label: "নিষ্ক্রিয়", tone: "muted", hint: "প্রবেশাধিকার বন্ধ" },
};

export function userStatus(status: string) {
  return USER_STATUS[status] ?? { label: status, tone: "muted" as StatusTone, hint: "" };
}
