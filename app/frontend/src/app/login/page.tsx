"use client";

import { useEffect } from "react";

import { HMAuthFlow } from "@/components/auth/auth-flow";
import {
  HMBackdrop,
  HMBrandHeader,
  HMFooter,
  HMProductMock,
  HMTestimonial
} from "@/components/auth/auth-decor";
import { useTheme } from "@/components/theme-provider";
import { useStrings, type Lang } from "@/lib/i18n";

import "./login.css";

import { useState } from "react";

/**
 * Homora.ai — Split login layout (Variation A from the design canvas).
 *
 * Left panel  → purple brand surface with hex backdrop + product mock + testimonial.
 * Right panel → form panel hosting <HMAuthFlow>.
 *
 * Theme + language toggles live in both panel headers; their state is
 * lifted here so the whole page reacts in lockstep.
 */
export default function LoginPage() {
  const { theme, toggle } = useTheme();
  const [lang, setLang] = useState<Lang>("tr");
  const t = useStrings(lang);

  // If we're already authed, bounce to the dashboard. This handles the
  // "user manually visits /login while signed in" case without flashing
  // the login UI.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("homora-auth-token")) {
        window.location.replace("/");
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      className="hm-root"
      data-theme={theme}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--surface)",
        overflow: "auto"
      }}
    >
      <div
        style={{
          minHeight: "100%",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          background: "var(--surface)"
        }}
        data-mobile-stack
      >
        {/* ── LEFT — brand panel ────────────────────────────── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: 40,
            color: "#fff",
            minWidth: 0,
            minHeight: "100vh"
          }}
          className="hm-brand-panel"
        >
          <HMBackdrop />
          <HMBrandHeader
            t={t}
            lang={lang}
            onLang={setLang}
            theme={theme}
            onTheme={toggle}
          />

          {/* Mid: tagline + product mock */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              marginTop: 32
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,.12)",
                padding: "5px 10px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                alignSelf: "flex-start",
                marginBottom: 16
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "#86efac"
                }}
              />
              {t.brandTag}
            </span>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: "-0.025em",
                lineHeight: 1.15,
                margin: 0,
                textWrap: "balance",
                maxWidth: 440
              }}
            >
              {t.productHeadline}
            </h2>
            <p
              style={{
                marginTop: 14,
                fontSize: 15,
                lineHeight: 1.55,
                opacity: 0.78,
                maxWidth: 420
              }}
            >
              {t.productSub}
            </p>

            <HMProductMock t={t} style={{ marginTop: 28, maxWidth: 460 }} />
          </div>

          <HMTestimonial t={t} style={{ position: "relative", zIndex: 2 }} />
        </div>

        {/* ── RIGHT — form panel ────────────────────────────── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: 40,
            background: "var(--surface)",
            minWidth: 0,
            minHeight: "100vh"
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <HMBrandHeader
              t={t}
              lang={lang}
              onLang={setLang}
              theme={theme}
              onTheme={toggle}
              color="var(--ink-700)"
            />
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              maxWidth: 420,
              width: "100%",
              margin: "0 auto"
            }}
          >
            <HMAuthFlow t={t} />
          </div>
          <HMFooter t={t} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          [data-mobile-stack] {
            grid-template-columns: 1fr !important;
          }
          .hm-brand-panel {
            min-height: 40vh !important;
          }
        }
      `}</style>
    </div>
  );
}
