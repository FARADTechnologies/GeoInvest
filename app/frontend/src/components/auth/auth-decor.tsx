// Decorative chrome for the brand panel: hex pattern background, product
// mock card with mini H3 heatmap, and the testimonial figure.

import type { CSSProperties, ReactElement } from "react";

import { HMIcon } from "@/components/auth/auth-icons";
import { HomoraLogo } from "@/components/brand/homora-logo";
import type { Lang } from "@/lib/i18n";

// ──────────────────────────────────────────────────────────────────────
// Hex-grid backdrop (mesh + honeycomb overlay).
// ──────────────────────────────────────────────────────────────────────

export function HMBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, var(--brand-700) 0%, var(--brand-600) 50%, var(--brand-500) 100%)"
        }}
      />
      <HMHexPattern />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 0%, rgba(255,255,255,.12), transparent 50%)," +
            "radial-gradient(circle at 80% 100%, rgba(0,0,0,.18), transparent 60%)",
          mixBlendMode: "overlay"
        }}
      />
    </div>
  );
}

function hexPoints(cx: number, cy: number, s: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(
      `${(cx + s * Math.cos(angle)).toFixed(2)},${(cy + s * Math.sin(angle)).toFixed(2)}`
    );
  }
  return pts.join(" ");
}

function HMHexPattern() {
  const side = 28;
  const w = Math.sqrt(3) * side;
  const h = 1.5 * side;
  const highlights: [number, number, number][] = [
    [2, 1, 0.55], [3, 2, 0.85], [4, 1, 0.4],
    [6, 3, 0.6], [7, 4, 0.35], [5, 4, 0.5],
    [1, 5, 0.4], [3, 6, 0.7], [4, 7, 0.45],
    [7, 6, 0.55], [8, 5, 0.3]
  ];
  const cols = 11;
  const rows = 13;
  const cells: ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * w + (r % 2 ? w / 2 : 0);
      const y = r * h;
      const hl = highlights.find(([hc, hr]) => hc === c && hr === r);
      cells.push(
        <polygon
          key={`${c}-${r}`}
          points={hexPoints(x + w / 2, y + side, side)}
          fill={hl ? `rgba(255,255,255,${hl[2] * 0.18})` : "none"}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
        />
      );
    }
  }
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${cols * w} ${rows * h}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0 }}
    >
      {cells}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Product mock card (Baku H3 mini heatmap + 2 stats).
// ──────────────────────────────────────────────────────────────────────

type ProductMockProps = {
  t: Record<string, string>;
  style?: CSSProperties;
};

export function HMProductMock({ t, style }: ProductMockProps) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,.10)",
        border: "1px solid rgba(255,255,255,.18)",
        borderRadius: 14,
        padding: 12,
        WebkitBackdropFilter: "blur(8px)",
        backdropFilter: "blur(8px)",
        ...style
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#86efac"
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>
            Bakı · İstilik xəritəsi
          </span>
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            padding: "2px 8px",
            background: "rgba(255,255,255,.16)",
            borderRadius: 999,
            letterSpacing: "0.04em",
            textTransform: "uppercase"
          }}
        >
          Live
        </span>
      </div>

      <div
        style={{
          height: 130,
          borderRadius: 10,
          background: "rgba(0,0,0,.18)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <HMMiniHeatmap />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 10
        }}
      >
        <Stat label={t.statListings} value="12,847" />
        <Stat label={t.statAccuracy} value="94.6%" accent="#86efac" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontSize: 10.5,
          opacity: 0.65,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase"
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          marginTop: 2,
          color: accent ?? "#fff"
        }}
      >
        {value}
      </span>
    </div>
  );
}

function HMMiniHeatmap() {
  const side = 12;
  const w = Math.sqrt(3) * side;
  const h = 1.5 * side;
  const cols = 18;
  const rows = 9;
  const heat = (c: number, r: number): number => {
    const cx = cols * 0.42;
    const cy = rows * 0.55;
    const d = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
    const wave = Math.sin(c * 0.6) * 1.4 + Math.cos(r * 0.7) * 1.2;
    return Math.max(0, 1 - d / (cols * 0.55) + wave * 0.06);
  };
  const colorFor = (v: number): string => {
    if (v < 0.15) return "rgba(255,255,255,0.05)";
    if (v < 0.35) return "rgba(199,210,254,0.35)";
    if (v < 0.55) return "rgba(165,180,252,0.6)";
    if (v < 0.75) return "rgba(196,181,253,0.85)";
    return "rgba(253,224,71,0.92)";
  };
  const cells: ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = heat(c, r);
      if (v < 0.05) continue;
      const x = c * w + (r % 2 ? w / 2 : 0);
      const y = r * h;
      cells.push(
        <polygon
          key={`${c}-${r}`}
          points={hexPoints(x + w / 2, y + side, side - 0.8)}
          fill={colorFor(v)}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="0.6"
        />
      );
    }
  }
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${cols * w + w / 2} ${rows * h + side}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {cells}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Testimonial chip.
// ──────────────────────────────────────────────────────────────────────

export function HMTestimonial({
  t,
  style
}: {
  t: Record<string, string>;
  style?: CSSProperties;
}) {
  return (
    <figure
      style={{
        margin: 0,
        borderRadius: 14,
        padding: "16px 18px",
        background: "rgba(255,255,255,.10)",
        border: "1px solid rgba(255,255,255,.16)",
        WebkitBackdropFilter: "blur(8px)",
        backdropFilter: "blur(8px)",
        ...style
      }}
    >
      <blockquote
        style={{
          margin: 0,
          fontSize: 14.5,
          lineHeight: 1.55,
          fontWeight: 500,
          color: "#fff",
          letterSpacing: "-0.005em"
        }}
      >
        &ldquo;{t.testimonial}&rdquo;
      </blockquote>
      <figcaption
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "linear-gradient(135deg, #fbbf24, #f97316)",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          MA
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
            {t.testimonialAuthor}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, color: "#fff" }}>
            {t.testimonialRole}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Brand header — used on both the purple panel and the form panel.
// ──────────────────────────────────────────────────────────────────────

export function HMBrandHeader({
  t,
  lang,
  onLang,
  theme,
  onTheme,
  color = "#fff"
}: {
  t: Record<string, string>;
  lang: Lang;
  onLang: (l: Lang) => void;
  theme: "light" | "dark";
  onTheme: () => void;
  color?: string;
}) {
  const onLight = color === "#fff";
  const bg = onLight ? "rgba(255,255,255,.08)" : "transparent";
  const border = onLight ? "rgba(255,255,255,.2)" : "var(--surface-line, hsl(var(--border)))";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Official Homora.ai wordmark (team #4), inlined so it can't 404 on
            deploy. On the coloured/dark panel it's flattened to white. */}
        <HomoraLogo height={28} mono={onLight} />
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => onLang(lang === "az" ? "en" : "az")}
          style={{
            appearance: "none",
            border: `1px solid ${border}`,
            background: bg,
            color,
            cursor: "pointer",
            padding: "5px 10px",
            borderRadius: 8,
            font: "inherit",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <HMIcon name="globe" size={13} /> {lang.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={onTheme}
          style={{
            appearance: "none",
            border: `1px solid ${border}`,
            background: bg,
            color,
            cursor: "pointer",
            width: 30,
            height: 30,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          aria-label="Toggle theme"
        >
          <HMIcon name={theme === "light" ? "moon" : "sun"} size={14} />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Footer chip row.
// ──────────────────────────────────────────────────────────────────────

export function HMFooter({
  t,
  color = "var(--ink-500)"
}: {
  t: Record<string, string>;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 12,
        color,
        fontWeight: 500
      }}
    >
      <span>{t.copyright}</span>
      <div style={{ display: "flex", gap: 16 }}>
        <a href="mailto:office@homora.ai" style={{ color: "inherit", textDecoration: "none" }}>
          {t.help}
        </a>
        <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
          {t.privacy}
        </a>
        <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
          {t.terms}
        </a>
      </div>
    </div>
  );
}
