import { SignUpForm } from "./_components/SignUpForm";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-2xl font-semibold">নতুন অ্যাকাউন্ট</h1>
      <SignUpForm />
    </main>
  );
}
