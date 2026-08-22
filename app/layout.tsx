import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReviewForge — Campaign-ready content, forged by agents",
  description:
    "An AI creator agent that turns campaign requirements, visit photos, and firsthand notes into a verified blog draft.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
