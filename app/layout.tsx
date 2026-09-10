import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReviewForge — Campaign-ready content, forged by agents",
  description:
    "An AI creator agent that turns campaign requirements, visit photos, and firsthand notes into a verified blog draft.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page paint under the Dynamic Island and home indicator; the CSS pads
  // itself back out with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#111210",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
