// Inline 20px stroke icons. ~24 of them is less bytes than any icon package, and inlining
// keeps them tree-shaken by definition. All `currentColor`, all aria-hidden — an icon-only
// control carries its meaning in the button's aria-label, never in the glyph.
//
// Replaces the `☰` text glyph in the nav, the `→`/`←` arrows used as affordances, and the two
// one-off SVGs that lived inside ThemeToggle.

type IconProps = { className?: string; size?: number };

function Svg({ className, size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Svg>
  );
}

export function ChildrenIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21v-1.5A5.5 5.5 0 0 1 10.5 14h3A5.5 5.5 0 0 1 19 19.5V21" />
    </Svg>
  );
}

export function InventoryIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </Svg>
  );
}

export function CatalogIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
      <path d="M8 7.5h7M8 11h5" />
    </Svg>
  );
}

export function ReportsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 21h18" />
      <rect x="5" y="12" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="8" width="3.5" height="10" rx="1" />
      <rect x="15.5" y="4" width="3.5" height="14" rx="1" />
    </Svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20v-1a4.5 4.5 0 0 1 4.5-4.5h3A4.5 4.5 0 0 1 15 19v1" />
      <path d="M16 5.2a3.25 3.25 0 0 1 0 5.6M17.5 14.6A4.5 4.5 0 0 1 21 19v1" />
    </Svg>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M18 9a6 6 0 1 0-12 0c0 4.5-2 6-2 6h16s-2-1.5-2-6" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" />
    </Svg>
  );
}

export function SettingsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.11A1.7 1.7 0 0 0 4.67 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1z" />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m15 5-7 7 7 7" />
    </Svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 9 7 7 7-7" />
    </Svg>
  );
}

export function SunIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </Svg>
  );
}

export function MoonIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function DownloadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}

export function PrinterIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <rect x="7" y="14" width="10" height="7" rx="1" />
    </Svg>
  );
}

export function AlertTriangleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.5M12 17.2h.01" />
    </Svg>
  );
}

export function CheckCircleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.4 2.7 2.6L16 9.6" />
    </Svg>
  );
}

export function XCircleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8h.01" />
    </Svg>
  );
}

export function RefreshIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 11a8 8 0 0 0-13.7-5.2L3 9" />
      <path d="M3 4v5h5" />
      <path d="M4 13a8 8 0 0 0 13.7 5.2L21 15" />
      <path d="M21 20v-5h-5" />
    </Svg>
  );
}

export function InboxIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 13h4l1.5 3h7L17 13h4" />
      <path d="M4.6 5.7 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-1.6-7.3A2 2 0 0 0 17.5 4h-11a2 2 0 0 0-1.9 1.7z" />
    </Svg>
  );
}

export function EyeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function EyeOffIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.7 3.4M6.2 8A17 17 0 0 0 2.5 12S6 18 12 18a9.4 9.4 0 0 0 3.5-.66" />
      <path d="m9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </Svg>
  );
}

// ── Destination icons for the 23-item nav ────────────────────────────────────

export function GuardiansIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9.5" r="2.25" />
      <path d="M2.5 20v-1a4.5 4.5 0 0 1 4.5-4.5h2A4.5 4.5 0 0 1 13.5 19v1" />
      <path d="M15 14.5h1.5A4 4 0 0 1 20.5 18.5V20" />
    </Svg>
  );
}

export function TracingIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function ZeroDoseIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m7.5 7.5 9 9" />
    </Svg>
  );
}

export function DuplicatesIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="12" height="12" rx="2" />
      <path d="M9 18v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1" />
    </Svg>
  );
}

export function CoverageIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 8.5 6.1L12 12z" />
      <path d="M12 12v9" />
    </Svg>
  );
}

export function SessionsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="m9.5 15 1.8 1.8 3.4-3.4" />
    </Svg>
  );
}

export function AefiIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20.5 13.5A8.5 8.5 0 1 1 12 3.5" />
      <path d="M12 8v4.5l3 1.8" />
      <path d="M18.5 3v5M18.5 10.4h.01" />
    </Svg>
  );
}

export function DataQualityIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <ellipse cx="12" cy="5.5" rx="8" ry="2.75" />
      <path d="M4 5.5v6c0 1.5 3.6 2.75 8 2.75s8-1.25 8-2.75v-6" />
      <path d="M4 11.5v6c0 1.5 3.6 2.75 8 2.75" />
      <path d="m15.5 18.2 1.7 1.7 3.3-3.4" />
    </Svg>
  );
}

export function StockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5h16M4 12h16M4 19h16" />
      <circle cx="8.5" cy="5" r="1.75" />
      <circle cx="15.5" cy="12" r="1.75" />
      <circle cx="10.5" cy="19" r="1.75" />
    </Svg>
  );
}

export function RequisitionsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 3h8a1 1 0 0 1 1 1v1H7V4a1 1 0 0 1 1-1z" />
      <path d="M7 5H5.5A1.5 1.5 0 0 0 4 6.5v13A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 18.5 5H17" />
      <path d="M8.5 11h7M8.5 15h4" />
    </Svg>
  );
}

export function ColdChainIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11" />
      <path d="M9 4.5 12 7l3-2.5M9 19.5 12 17l3 2.5" />
    </Svg>
  );
}

export function LocationsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 4-6 2.5v13L9 17l6 3 6-2.5v-13L15 7z" />
      <path d="M9 4v13M15 7v13" />
    </Svg>
  );
}

export function FacilitiesIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M4 21h16" />
      <path d="M12 9v5M9.5 11.5h5" />
    </Svg>
  );
}

export function PopulationIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 21h18" />
      <path d="M6 21V9l6-4.5L18 9v12" />
      <path d="M10 21v-5h4v5" />
    </Svg>
  );
}

export function BreakGlassIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.5 4 5.5v6c0 4.6 3.3 8.6 8 10 4.7-1.4 8-5.4 8-10v-6z" />
      <path d="M12 8v4M12 15.2h.01" />
    </Svg>
  );
}

export function HelpIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4" />
      <path d="M12 16.8h.01" />
    </Svg>
  );
}
