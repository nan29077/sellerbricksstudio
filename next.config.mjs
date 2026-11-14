import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// 보안 헤더: 다른 사이트에 iframe 으로 끼워 넣기(클릭재킹) 차단, MIME 추측 차단, 리퍼러 최소화, 브라우저 권한 제한.
// CSP 는 스크립트를 막지 않는 안전한 항목만 적용한다 (Next.js 인라인 스크립트와 충돌하지 않게).
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self)" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

// 이미지 최적화 서버가 아무 외부 주소나 대신 내려받지 않도록, 허용할 이미지 호스트만 적는다.
// 예) IMAGE_HOSTS="my-bucket.s3.ap-northeast-2.amazonaws.com,cdn.example.com"  (외부 이미지는 기본적으로 최적화 없이 그대로 표시)
const imageHosts = (process.env.IMAGE_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);

/** @type {(phase: string) => import('next').NextConfig} */
const nextConfig = (phase) => ({
  // 개발 서버와 프로덕션 빌드가 서로의 청크와 매니페스트를 덮어쓰지 않도록 한다.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // src/instrumentation.ts (선택: INTERNAL_CRON=1 일 때 서버 내장 스케줄러)
  experimental: { instrumentationHook: true, serverComponentsExternalPackages: ["exceljs"] },
  images: { remotePatterns: imageHosts.map((hostname) => ({ protocol: "https", hostname })) },
  // ESLint 는 `npm run lint` 로 따로 돌린다 (빌드는 TypeScript 타입 체크만으로 막는다)
  eslint: { ignoreDuringBuilds: true },
  // 없어진 화면의 예전 주소 (2026-11-14): 구매자 · 방송 기능 삭제, 사이트 관리 탭 병합
  async redirects() {
    return [
      { source: "/admin/site-settings", destination: "/admin/site-management?tab=basic", permanent: false },
      { source: "/admin/home-background", destination: "/admin/site-management?tab=background", permanent: false },
      { source: "/admin/live-settings", destination: "/admin/site-management?tab=access", permanent: false },
      { source: "/seller/live-sessions/:path*", destination: "/seller/orders", permanent: false },
      { source: "/seller/kakao", destination: "/seller/orders", permanent: false },
      { source: "/seller/marketing/coupons", destination: "/seller/orders", permanent: false },
      { source: "/facility/live-sessions/:path*", destination: "/facility/orders", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
});
export default nextConfig;
