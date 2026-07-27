import { SignInForm } from "./_components/SignInForm";

export const metadata = { title: "লগইন" };

// The heading and the shell both live elsewhere now — the form owns its own <h1> so it can sit
// above the tablist, and the (auth) layout owns the brand panel and the centring.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  return <SignInForm initialMode={role === "parent" ? "otp" : "password"} />;
}
