import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReviewForge — Campaign-ready content, forged by agents",
  description:
    "캠페인 조건, 사진, 실제 경험을 하나의 검증된 블로그 초안으로 만드는 Creator Agent",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
