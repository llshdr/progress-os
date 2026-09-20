import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#080B10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-lapis-bg text-lapis-text-primary">{children}</body>
    </html>
  );
}
