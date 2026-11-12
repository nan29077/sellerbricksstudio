import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3007").replace(/\/$/, "");

export const revalidate = 3600;

// 공개 페이지와 승인된 창고(스튜디오) · 브랜드샵 상세 페이지를 검색엔진에 알린다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/intro`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/facilities`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/brands`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/notices`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE}/order-lookup`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const facilities = await prisma.facility.findMany({
      where: { status: "APPROVED" }, select: { id: true, updatedAt: true }, take: 1000,
    });
    for (const f of facilities) {
      pages.push({ url: `${SITE}/facilities/${f.id}`, lastModified: f.updatedAt, changeFrequency: "weekly", priority: 0.7 });
    }
    // 공개된 브랜드샵 (승인 · 대표 계정 사용 중)
    const shops = await prisma.brandShop.findMany({
      where: { status: "APPROVED", owner: { isActive: true, role: "BRAND_ADMIN" } }, select: { id: true, updatedAt: true }, take: 1000,
    });
    for (const b of shops) {
      pages.push({ url: `${SITE}/brands/${b.id}`, lastModified: b.updatedAt, changeFrequency: "weekly", priority: 0.6 });
    }
  } catch {
    // DB에 연결할 수 없으면 기본 페이지만 내보낸다.
  }
  return pages;
}
