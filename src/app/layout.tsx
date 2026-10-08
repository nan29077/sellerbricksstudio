import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";

const siteName = "셀러브릭스 스튜디오";
const shareTitle = "방송에만 집중하세요. 나머지는 우리가 합니다.";
const shareDescription = "공간 탐색부터 라이브 준비와 판매 관리까지, 셀러브릭스 스튜디오에서 이어보세요.";
const shareImage = "/images/social/share-card.png?v=2";

function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim()
    ?? requestHeaders.get("host")?.split(",")[0]?.trim();
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim()
    ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  for (const candidate of [
    configuredUrl,
    vercelUrl ? `https://${vercelUrl}` : undefined,
    host ? `${protocol}://${host}` : undefined,
  ]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      const configuredIsLocal = candidate === configuredUrl && ["localhost", "127.0.0.1"].includes(url.hostname);
      if (configuredIsLocal && host) continue;
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      // Skip invalid deployment URLs and use the next available host.
    }
  }

  return new URL("http://localhost:3007");
}

export function generateMetadata(): Metadata {
  return {
    metadataBase: getSiteUrl(),
    title: `${siteName} | 방송에만 집중하세요`,
    description: shareDescription,
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName,
      title: `${shareTitle} | ${siteName}`,
      description: shareDescription,
      images: [{ url: shareImage, width: 1200, height: 630, alt: `${siteName} — ${shareTitle}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${shareTitle} | ${siteName}`,
      description: shareDescription,
      images: [shareImage],
    },
  };
}
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
