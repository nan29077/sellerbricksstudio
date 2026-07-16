import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "셀러브릭스 스튜디오 - 셀러에게 필요한 모든 것",
  description: "플랫폼 지원·라이브커머스·마케팅·스튜디오·소싱·결제·세무까지 — 셀러브릭스 스튜디오가 모두 지원합니다",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
