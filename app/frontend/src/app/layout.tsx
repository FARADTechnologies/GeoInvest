import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homora.ai · Real Estate Intelligence",
  description: "H3 hexagonal real estate analytics dashboard — Homora.ai"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is set client-side by <ThemeProvider> on mount.
    // We default to "light" to avoid a flash; <ThemeProvider> overrides
    // immediately based on localStorage / prefers-color-scheme.
    <html lang="tr" data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
