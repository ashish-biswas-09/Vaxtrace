import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "../_components/ui";

export const dynamic = "force-dynamic";

// The Help screen §16.2 lists among the shared five.
//
// It is deliberately a glossary rather than a manual. The audit's UX-03 finding was
// terminology drift across roles: three screens using three words for the same thing is what
// makes a system feel like three systems. A single definition list, linked from the nav, is
// the cheapest correction — and every definition here says *where the number comes from*,
// because the question an administrator actually arrives with is not "what does dropout mean"
// but "why does this screen say 68% and that one says 91%".
const GLOSSARY: { term: string; body: React.ReactNode; where: { href: string; label: string } }[] = [
  {
    term: "নিবন্ধন-ভিত্তিক কভারেজ (registry coverage)",
    body: (
      <>
        সিস্টেমে নিবন্ধিত শিশুদের মধ্যে কত অংশের নির্ধারিত ডোজ সময়মতো দেওয়া হয়েছে। ভগ্নাংশের নিচে
        থাকে <em>আমরা যাদের চিনি</em>। এটি তথ্যের মানের সূচক — জনস্বাস্থ্যের নয়, কারণ যে কেন্দ্র
        শুধু সহজে পৌঁছানো যায় এমন পরিবারগুলোকেই নিবন্ধন করে, তার হিসাব প্রায় ১০০% দেখাবে।
      </>
    ),
    where: { href: "/admin/coverage", label: "এলাকাভিত্তিক কভারেজ" },
  },
  {
    term: "জনসংখ্যা-ভিত্তিক কভারেজ (population coverage)",
    body: (
      <>
        এলাকায় <em>যত শিশু আছে</em> (জনসংখ্যার হিসাব থেকে) তার কত অংশ নির্দিষ্ট টিকার শেষ ডোজ
        পেয়েছে। হর না থাকলে এই ঘরে &ldquo;—&rdquo; থাকে; ০% নয়, কারণ &ldquo;হিসাব করা যায়
        না&rdquo; আর &ldquo;কেউ পায়নি&rdquo; এক জিনিস নয়।
      </>
    ),
    where: { href: "/admin/population", label: "জনসংখ্যার হিসাব" },
  },
  {
    term: "শূন্য-ডোজ শিশু (zero-dose)",
    body: (
      <>
        যে শিশু পেন্টাভ্যালেন্টের (DTP-যুক্ত টিকা) প্রথম ডোজ কখনো পায়নি — WHO/IA2030-এর সংজ্ঞা।
        সূচক হিসেবে ১২–২৩ মাস বয়সীদের ধরা হয় (পেছন ফিরে দেখা), আর কাজের তালিকা হিসেবে ১২ মাসের
        কম বয়সীদের, কারণ তাদের কাছে এখনো পৌঁছানো সম্ভব।
      </>
    ),
    where: { href: "/admin/zero-dose", label: "শূন্য-ডোজ শিশু" },
  },
  {
    term: "ড্রপআউট (dropout)",
    body: (
      <>
        (প্রথম ডোজ − শেষ ডোজ) ÷ প্রথম ডোজ, একই দলের শিশুদের মধ্যে। ১০%-এর বেশি হলে সমস্যাটি কম
        কভারেজ নয় — শিশুরা একবার এসেছিল, ফিরে আসেনি। এই দুটি সমস্যার সমাধানও আলাদা।
      </>
    ),
    where: { href: "/admin/reports", label: "রিপোর্ট" },
  },
  {
    term: "অপচয়ের হার (wastage rate)",
    body: (
      <>
        অপচয় ÷ (অপচয় + প্রয়োগকৃত), গত ৯০ দিনে। হর হিসেবে শুধু প্রয়োগকৃত ডোজ ধরলে হার কম দেখায় —
        WHO-র সংজ্ঞা ব্যবহার করা হয়েছে। খোলা ভায়ালের অপচয়ই সাধারণত সবচেয়ে বড় অংশ, এবং সেটি ভায়ালের
        আকার নির্বাচনের সিদ্ধান্তে সরাসরি কাজে লাগে।
      </>
    ),
    where: { href: "/admin/stock", label: "স্টক লেজার" },
  },
  {
    term: "ভূমিকা × এলাকা (role × scope)",
    body: (
      <>
        অনুমতি = কী করতে পারেন (ভূমিকা) × কোন সারিগুলোতে (এলাকা)। একজন উপজেলা ব্যবস্থাপক আর একজন
        জেলা ব্যবস্থাপকের কাজ একই, শুধু এলাকা আলাদা — তাই আলাদা ভূমিকা বানানো হয়নি। এলাকার
        হিসাব প্রতিটি প্রশ্নের সময় ডেটাবেস থেকে পড়া হয়, টোকেন থেকে নয়, যাতে দায়িত্ব বদলালে
        অনুমতিও সঙ্গে সঙ্গে বদলায়।
      </>
    ),
    where: { href: "/admin/users", label: "ব্যবহারকারী" },
  },
  {
    term: "জরুরি প্রবেশাধিকার (break-glass)",
    body: (
      <>
        নিজের এলাকার বাইরের কোনো শিশুর রেকর্ড দেখার প্রয়োজন সত্যিই হয় — অন্য জেলার শিশু সেশনে
        উপস্থিত হলে। নিষিদ্ধ করলে কর্মী ডুপ্লিকেট নিবন্ধন করে ফেলেন, তাই এটি অনুমোদিত, কারণ লিখতে
        হয়, ৪ ঘণ্টা পরে নিজে থেকেই শেষ হয়, এবং প্রতিটি ব্যবহার পর্যালোচনার তালিকায় ওঠে।
      </>
    ),
    where: { href: "/admin/break-glass", label: "জরুরি প্রবেশাধিকার" },
  },
  {
    term: "স্টক লেজার ও মজুদের সংখ্যা",
    body: (
      <>
        মজুদের সংখ্যা কেউ লেখে না — এটি লেজারের সব সারির যোগফল। প্রতিটি প্রয়োগকৃত ডোজ, অপচয়,
        গ্রহণ ও স্থানান্তর একটি করে সারি, আর সারি কখনো মোছা যায় না। ভুল হলে বিপরীত সমন্বয় লিখতে
        হয়। প্রতি রাতে মিলকরণ চলে; না মিললে সেটি ত্রুটি হিসেবে রিপোর্ট হয়।
      </>
    ),
    where: { href: "/admin/stock", label: "স্টক লেজার" },
  },
  {
    term: "সেশন ও কেন্দ্র",
    body: (
      <>
        কেন্দ্র হলো <em>কে সেবা দিচ্ছে</em>, সেশনের এলাকা হলো <em>কোথায় দিচ্ছে</em>। আউটরিচে
        দুটি আলাদা। কেন্দ্রের নিজের ওয়ার্ডের নামে আউটরিচের হিসাব রাখলে যে ওয়ার্ডে সেবা পৌঁছায়নি
        সেটিও সেবা পেয়েছে বলে দেখাবে — এলাকাভিত্তিক প্রতিটি সংখ্যা তখন ভুল হবে।
      </>
    ),
    where: { href: "/admin/sessions", label: "টিকাদান সেশন" },
  },
  {
    term: "শিশুর অবস্থা (child lifecycle)",
    body: (
      <>
        সক্রিয়, এলাকা ছেড়েছে, স্থানান্তরিত, অভিভাবক রাজি নন, মৃত, বয়স পেরিয়েছে। শুধু
        &ldquo;সক্রিয়&rdquo; শিশুরাই রিমাইন্ডার পায় ও ডিফল্টার তালিকায় আসে। মৃত শিশুর পরিবারকে
        &ldquo;পরের টিকার সময় হয়েছে&rdquo; বার্তা পাঠানো এমন ব্যর্থতা, যা কোনো কভারেজ সূচকে ধরা
        পড়ে না।
      </>
    ),
    where: { href: "/admin/children", label: "শিশু" },
  },
];

export default async function HelpPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="সহায়িকা ও শব্দকোষ"
        description="একই জিনিসের তিনটি নাম থাকলে একটি সিস্টেম তিনটি সিস্টেমের মতো মনে হয়। এখানে প্রতিটি সংখ্যার সংজ্ঞা এবং সেটি কোথা থেকে আসে, তা এক জায়গায় লেখা আছে।"
      />

      <dl className="flex flex-col gap-4">
        {GLOSSARY.map((g) => (
          <div key={g.term} className="rounded-xl border border-[var(--color-border)] p-5">
            <dt className="font-medium">{g.term}</dt>
            <dd className="mt-2 text-sm text-[var(--color-muted)]">
              {g.body}
              <Link
                href={g.where.href}
                className="mt-3 block text-sm text-[var(--color-primary)]"
              >
                {g.where.label} →
              </Link>
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-[var(--color-border)] p-5">
        <h2 className="text-lg font-medium">কোনো সংখ্যা সন্দেহজনক মনে হলে</h2>
        <ol className="mt-3 flex list-inside list-decimal flex-col gap-2 text-sm text-[var(--color-muted)]">
          <li>
            <Link href="/admin/data-quality" className="text-[var(--color-primary)]">
              তথ্যের মান
            </Link>{" "}
            দেখুন — অসম্পূর্ণ তথ্যই বেশিরভাগ অদ্ভুত সংখ্যার কারণ।
          </li>
          <li>
            <Link href="/admin/settings" className="text-[var(--color-primary)]">
              সেটিংসে কাজের অবস্থা
            </Link>{" "}
            দেখুন — কোনো রাতের কাজ বন্ধ থাকলে হিসাব পুরনো হতে পারে।
          </li>
          <li>
            <Link href="/admin/audit" className="text-[var(--color-primary)]">
              অডিট লগে
            </Link>{" "}
            দেখুন কে কখন কী বদলেছে — জনসংখ্যার হিসাব বদলালে প্রকাশিত প্রতিটি কভারেজ সংখ্যা নড়ে।
          </li>
        </ol>
      </section>
    </div>
  );
}
