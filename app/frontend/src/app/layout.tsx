import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

import { Providers } from "@/components/providers";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap"
});

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
    <html lang="az" data-theme="light" suppressHydrationWarning>
      <body className={jakarta.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
