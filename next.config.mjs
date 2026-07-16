/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // ESLint 설정이 없어도 빌드가 멈추지 않도록 함 (TypeScript 타입 체크는 유지)
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
