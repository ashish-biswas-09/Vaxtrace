import Link from "next/link";

// The one button. Before this, the primary style was a hand-copied class string in seven
// files — four page headers, the admin error boundary, the sign-in form and the role picker —
// so a change to the CTA meant seven edits and they had already drifted on padding.
//
// Not marked "use client": it holds no state, so it renders as markup in server components
// and joins the client bundle only where a client parent imports it.

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:hover:bg-[var(--accent)]",
  secondary:
    "border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)]",
  ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]",
  danger: "bg-[var(--danger)] text-white hover:opacity-90",
};

// h-11 on `lg` is the 44px minimum touch target; `sm` is for in-row controls only, where the
// row itself provides the target area.
const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[0.8125rem]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center rounded-[var(--r-md)] font-medium transition-colors duration-[var(--dur-fast)] disabled:cursor-not-allowed disabled:opacity-55";

export type ButtonProps = {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  iconTrailing?: React.ReactNode;
  loading?: boolean;
  href?: string;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconTrailing,
  loading = false,
  href,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = `${BASE} ${SIZE[size]} ${VARIANT[variant]} ${className}`;

  // The label stays put while loading — swapping it for "সংরক্ষণ হচ্ছে…" reflows the button
  // mid-click and moves whatever is next to it.
  const body = (
    <>
      {loading ? <Spinner /> : icon}
      {children}
      {iconTrailing}
    </>
  );

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {body}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
