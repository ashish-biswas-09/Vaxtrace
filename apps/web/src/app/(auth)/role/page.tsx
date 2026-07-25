import Link from "next/link";

// A2, the entry chooser.
//
// What this screen picks is an *entry path*, not a role. The role is a property of the
// account: the access-token hook stamps it from the user's highest live assignment, and
// roleLandingPath() redirects by that claim and never by what was tapped here. That was true
// before and stated only in a code comment, which is how "I chose admin but it sent me to the
// worker console" becomes a bug report instead of correct behaviour. Now the screen says it.
//
// The `role` query parameter is kept — sign-in/page.tsx maps it to the credential form — but
// the labels no longer promise it decides anything.
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

export default function RoleSelectionPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">কীভাবে প্রবেশ করবেন?</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
          আপনার দায়িত্ব ও প্রবেশাধিকার অ্যাকাউন্টের সঙ্গে যুক্ত — এখানে শুধু প্রবেশের পদ্ধতি বেছে
          নিচ্ছেন।
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        {PATHS.map(({ href, label, detail }) => (
          <Link
            key={href}
            href={href}
            className="rounded-md border border-[var(--color-border)] px-4 py-3 text-center hover:border-[var(--color-primary)]"
          >
            <span className="block font-medium">{label}</span>
            <span className="mt-1 block text-xs text-[var(--color-muted)]">{detail}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href="/claim" className="text-[var(--color-primary)] underline">
          টিকা কার্ডে শিশু আইডি আছে? অ্যাকাউন্টে যুক্ত করুন
        </Link>
        <Link href="/sign-up" className="text-[var(--color-muted)] underline">
          নতুন অভিভাবক অ্যাকাউন্ট খুলুন
        </Link>
      </div>
    </main>
  );
}
