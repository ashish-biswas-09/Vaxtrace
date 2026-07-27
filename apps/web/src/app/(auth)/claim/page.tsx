import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";
import { ClaimForm } from "./_components/ClaimForm";

export const dynamic = "force-dynamic";

// FR-15 / BS-02. The receiving end of "a worker registered your child, here is the ID".
//
// This is the screen that converts guardian onboarding from a prerequisite into a growth
// loop: the child exists in the register from the moment the worker enters them, and the
// guardian attaches their account to it later, or never, without the record being any less
// valid.
export default async function ClaimPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signing in has to happen first — the claim is authorised by the phone number Supabase
  // Auth has already verified for the session, so there is nothing to check against until
  // there is a session.
  if (!user) redirect("/sign-in?role=parent&next=claim");

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">শিশুকে অ্যাকাউন্টে যুক্ত করুন</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
          স্বাস্থ্যকর্মী আপনার শিশুকে নিবন্ধন করে থাকলে টিকা কার্ডে একটি শিশু আইডি লেখা আছে।
          সেটি দিয়ে শিশুর টিকার তথ্য আপনার অ্যাকাউন্টে যুক্ত করুন।
        </p>
      </div>

      <ClaimForm />

      <Link href="/parent" className="text-sm text-[var(--color-muted)] underline">
        পরে করব
      </Link>
    </div>
  );
}
