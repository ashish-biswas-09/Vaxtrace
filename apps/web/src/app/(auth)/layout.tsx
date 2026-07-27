import { CheckCircleIcon } from "@/components/icons";
import { ThemeToggle } from "../(admin)/admin/_components/ThemeToggle";

// The auth group had no layout at all: each screen was an <h1> and a 384px form centred on a
// blank page, with no branding, no theme and nothing that read as a government health system.
//
// Split shell — brand on the left, the task on the right. Below `lg` the brand collapses to a
// band so the form still opens above the fold on a phone.

const POINTS = [
  "১০-সংখ্যার স্থায়ী শিশু আইডি",
  "জন্মতারিখ থেকে স্বয়ংক্রিয় টিকার সূচি",
  "রিমাইন্ডার, কভারেজ ও মজুদ এক জায়গায়",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-[var(--text-primary)] lg:flex-row">
      <aside
        className="relative flex shrink-0 flex-col justify-between overflow-hidden px-6 py-8 text-white lg:w-[46%] lg:px-12 lg:py-12"
        style={{
          background:
            "linear-gradient(150deg, #0f766e 0%, #115e59 45%, #0b0f14 100%)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-white/15 text-base font-bold"
          >
            V
          </span>
          <span className="text-base font-semibold">ভ্যাক্সট্রেস</span>
        </div>

        <div className="hidden lg:block">
          <h2 className="text-3xl leading-tight font-semibold">
            শিশুদের টিকাদান
            <br />
            ট্র্যাকিং সিস্টেম
          </h2>
          <ul className="mt-6 flex flex-col gap-3 text-sm text-white/85">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <CheckCircleIcon size={18} className="mt-0.5 shrink-0 text-white/70" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-white/60 lg:mt-0">সম্প্রসারিত টিকাদান কর্মসূচি (EPI)</p>
      </aside>

      <main className="relative flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
