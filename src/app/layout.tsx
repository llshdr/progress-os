import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// The Lapis design system's three typefaces (see the Phase 1 design
// proposal) - loaded and self-hosted here, exposed as CSS variables only.
// Nothing in globals.css points font-sans/font-mono at these yet, so
// loading them has zero visual effect until Phase 1 deliberately adopts
// them screen-by-screen. Replaces the previous Inter import, which was
// never actually wired to font-sans either (dead since this file was
// first scaffolded) - removing it is a zero-risk cleanup, not a change.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const generalSans = localFont({
  variable: "--font-general-sans",
  display: "swap",
  src: [
    { path: "../fonts/general-sans/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/general-sans/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/general-sans/GeneralSans-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/general-sans/GeneralSans-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "L.A.P.I.S",
  description: "Personal operating system for ambitious people",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "L.A.P.I.S",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0C12",
  // Next's own default (width=device-width, initial-scale=1, no zoom
  // restriction) is what let pinch-zoom-out expose empty space beyond
  // the app's own content - confirmed against this installed version's
  // own docs (generate-viewport.md), not assumed. Explicit here so the
  // app behaves like installed native software, not a zoomable page.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jetbrainsMono.variable} ${generalSans.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-lapis-bg text-lapis-text-primary">{children}</body>
    </html>
  );
}
