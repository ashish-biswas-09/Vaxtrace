import { ResetPasswordForm } from "./_components/ResetPasswordForm";
import { VerifyOtpForm } from "./_components/VerifyOtpForm";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-2xl font-semibold">{phone ? "ওটিপি যাচাই" : "পাসওয়ার্ড রিসেট"}</h1>
      {phone ? <VerifyOtpForm phone={phone} /> : <ResetPasswordForm />}
    </main>
  );
}
