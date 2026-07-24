import { requireRole } from "@/lib/auth";

export default async function ParentHomePage() {
  await requireRole("parent");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">অভিভাবক অভিজ্ঞতা শীঘ্রই আসছে</h1>
      <p className="text-[var(--color-muted)]">
        এই স্ক্রিনটি ৩ আগস্টের ডেমোর অংশ নয় — লগইন যাচাইয়ের জন্য এই পেজটি রাখা হয়েছে।
      </p>
    </main>
  );
}
