import Link from "next/link";
import { AlertTriangleIcon, InfoIcon } from "@/components/icons";

// The inline notice shape. AEFI and the notifications hint each hand-rolled a bordered
// <section>; the two looked different for no reason and neither carried an icon.

const TONE = {
  danger: { fg: "var(--danger)", bg: "var(--danger-bg)" },
  warning: { fg: "var(--warning)", bg: "var(--warning-bg)" },
  info: { fg: "var(--text-secondary)", bg: "var(--surface-raised)" },
} as const;

export function Callout({
  tone = "info",
  title,
  children,
  href,
  hrefLabel,
}: {
  tone?: keyof typeof TONE;
  title: string;
  children?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  // Text mixed a fifth toward --text-primary: the raw tone on its own tint measured 4.0:1
  // (axe, light theme) — the same fix the status badges use.
  const { fg: tint, bg } = TONE[tone];
  const fg = `color-mix(in oklab, ${tint} 80%, var(--text-primary))`;
  const Icon = tone === "info" ? InfoIcon : AlertTriangleIcon;

  return (
    <div
      className="flex items-start gap-3 rounded-[var(--r-lg)] border px-4 py-3"
      style={{ background: bg, borderColor: `color-mix(in oklab, ${fg} 35%, transparent)` }}
    >
      <span style={{ color: fg }} className="mt-0.5 shrink-0">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: fg }}>
          {title}
        </p>
        {children && <div className="mt-1 text-sm text-[var(--text-secondary)]">{children}</div>}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 self-center text-xs font-medium whitespace-nowrap"
          style={{ color: fg }}
        >
          {hrefLabel ?? "দেখুন"} →
        </Link>
      )}
    </div>
  );
}
