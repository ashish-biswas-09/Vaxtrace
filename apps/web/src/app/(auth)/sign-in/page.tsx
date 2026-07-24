import { SignInForm } from "./_components/SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const initialMode = role === "parent" ? "otp" : "password";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-2xl font-semibold">লগইন করুন</h1>
      <SignInForm initialMode={initialMode} />
    </main>
  );
}
