import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";

// The entry chooser, and now also the landing screen.
//
// Splash and role selection were separate: the splash existed only to hold a "শুরু করুন"
// button, so it cost a whole screen before a single character could be typed. Merged, the
// landing page *is* the chooser, and the branding it used to carry lives in the auth shell.
//
// What this screen picks is an *entry path*, not a role. The role is a property of the
// account: the access-token hook stamps it from the user's highest live assignment, and
// roleLandingPath() redirects by that claim and never by what was tapped here. That was true
// before and stated only in a code comment, which is how "I chose admin but it sent me to the
// worker console" becomes a bug report instead of correct behaviour. The labels say it now.
//
// The `role` query parameter is kept — sign-in/page.tsx maps it to the credential form — but
// no label promises it decides anything.
const PATHS = [
  {
    href: "/sign-in?role=parent",
    label: "অভিভাবক",
    detail: "ফোন নম্বর ও ওটিপি দিয়ে প্রবেশ করুন",
  },
  {
    href: "/sign-in?role=worker",
    label: "স্বাস্থ্যকর্মী ও কর্মকর্তা",
    detail: "দাপ্তরিক ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন",
  },
] as const;

export default function EntryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">কীভাবে প্রবেশ করবেন?</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          আপনার দায়িত্ব ও প্রবেশাধিকার অ্যাকাউন্টের সঙ্গে যুক্ত — এখানে শুধু প্রবেশের পদ্ধতি বেছে
          নিচ্ছেন।
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {PATHS.map(({ href, label, detail }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] px-4 py-3.5 transition-colors hover:border-[var(--accent)]"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-[var(--text-muted)]">{detail}</span>
            </span>
            <ChevronRightIcon
              size={18}
              className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
            />
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <Link href="/claim" className="text-[var(--accent)] hover:underline">
          টিকা কার্ডে শিশু আইডি আছে? অ্যাকাউন্টে যুক্ত করুন
        </Link>
        <Link href="/sign-up" className="text-[var(--text-muted)] hover:text-[var(--accent)]">
          নতুন অভিভাবক অ্যাকাউন্ট খুলুন
        </Link>
      </div>
    </div>
  );
}
