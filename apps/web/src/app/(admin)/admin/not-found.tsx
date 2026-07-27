import { Button } from "@/components/ui/Button";

// notFound() from a detail route used to fall through to the root 404, which renders outside
// the admin shell with no nav and no theme scope — a dead end that looked like a broken app.
export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface)] p-8">
      <div>
        <h1 className="text-lg font-semibold">রেকর্ডটি পাওয়া যায়নি</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          এটি মুছে ফেলা হয়েছে, অথবা লিংকটি ভুল। তালিকা থেকে আবার খুঁজে দেখুন।
        </p>
      </div>
      <Button href="/admin">ড্যাশবোর্ডে ফিরুন</Button>
    </div>
  );
}
