import { ResetPasswordForm } from "./_components/ResetPasswordForm";
import { VerifyOtpForm } from "./_components/VerifyOtpForm";

export const metadata = { title: "যাচাই" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  return phone ? <VerifyOtpForm phone={phone} /> : <ResetPasswordForm />;
}
