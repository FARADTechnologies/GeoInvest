// Icon set ported 1:1 from the team's Homora B2B prototype.
// Outline stroke style, 24×24 viewbox. All accept { size, className, ...rest }.

import type { ReactNode, SVGProps } from "react";

type IconProps = { size?: number; className?: string; strokeWidth?: number } & SVGProps<SVGSVGElement>;

const I =
  (paths: ReactNode, vb = "0 0 24 24") =>
  ({ size = 18, className = "", strokeWidth = 1.8, ...rest }: IconProps) =>
    (
      <svg
        viewBox={vb}
        width={size}
        height={size}
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {paths}
      </svg>
    );

export const Icons = {
  Dashboard: I(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  ValueSingle: I(
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5" />
      <path d="M12 15v3" />
      <circle cx="12" cy="12.5" r="1.2" />
    </>
  ),
  ValueMass: I(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="M6.5 5.5l0 2 M5.5 6.5l2 0" />
    </>
  ),
  Market: I(
    <>
      <path d="M3 18l5-5 4 3 6-7" />
      <path d="M14 9h4v4" />
      <path d="M3 3v18h18" />
    </>
  ),
  Report: I(
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6 M9 17h4" />
    </>
  ),
  Search: I(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  ChevronDown: I(<path d="M6 9l6 6 6-6" />),
  ChevronRight: I(<path d="M9 6l6 6-6 6" />),
  ChevronLeft: I(<path d="M15 6l-6 6 6 6" />),
  ChevronUp: I(<path d="M6 15l6-6 6 6" />),
  Plus: I(
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  X: I(
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  Check: I(<path d="M5 13l4 4L19 7" />),
  Trash: I(
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </>
  ),
  Download: I(
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  Upload: I(
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </>
  ),
  File: I(
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  FileSpreadsheet: I(
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8 M8 17h8 M11 11v8" />
    </>
  ),
  Filter: I(<path d="M3 5h18l-7 9v6l-4-2v-4z" />),
  Sort: I(
    <>
      <path d="M3 7h13 M3 12h9 M3 17h5" />
      <path d="M18 9l3-3 3 3 M21 6v14" />
    </>
  ),
  Eye: I(
    <>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  PDF: I(
    <>
      <rect x="4" y="3" width="14" height="18" rx="2" />
      <text x="11" y="16" textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">
        PDF
      </text>
    </>
  ),
  Building: I(
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 7h2 M13 7h2 M9 11h2 M13 11h2 M9 15h2 M13 15h2" />
      <path d="M10 21v-3h4v3" />
    </>
  ),
  MapPin: I(
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  TrendUp: I(
    <>
      <path d="M22 7l-9 9-4-4-7 7" />
      <path d="M16 7h6v6" />
    </>
  ),
  TrendDown: I(
    <>
      <path d="M22 17l-9-9-4 4-7-7" />
      <path d="M16 17h6v-6" />
    </>
  ),
  Star: I(<path d="M12 2l3.1 6.3 7 1L17 14.2l1.2 7L12 17.8 5.8 21.2 7 14.2 2 9.3l7-1z" />),
  Sparkle: I(
    <>
      <path d="M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  Info: I(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01 M11 12h1v4h1" />
    </>
  ),
  Coin: I(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h4.5a2 2 0 110 4H9 M14 15H9 M11 7v10" />
    </>
  ),
  Bookmark: I(<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />),
  Edit: I(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4z" />
    </>
  ),
  Folder: I(<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />),
  Layers: I(
    <>
      <path d="M12 2l10 6-10 6L2 8z" />
      <path d="M2 16l10 6 10-6 M2 12l10 6 10-6" />
    </>
  ),
  Refresh: I(
    <>
      <path d="M3 12a9 9 0 0115-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  Users: I(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M21 21v-2a3 3 0 00-3-3" />
    </>
  )
};

export type IconName = keyof typeof Icons;
