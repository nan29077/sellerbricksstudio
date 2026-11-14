import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_NAME } from "@/lib/site-brand";
import { BrandStorefront } from "@/components/shop/brand-storefront";
import { StudioBroadcastRail } from "@/components/home/studio-broadcast-rail";
import { getBrandShopVideos } from "@/lib/home-videos";
import type { SP } from "@/lib/list";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const b = await prisma.brandShop.findUnique({ where: { id: params.id }, select: { name: true, tagline: true, status: true } }).catch(() => null);
  if (!b || b.status !== "APPROVED") return { title: `브랜드샵 | ${SITE_NAME}` };
  return { title: `${b.name} 브랜드샵 | ${SITE_NAME}`, description: b.tagline || undefined, openGraph: { title: `${b.name} | ${SITE_NAME}` } };
}

export const dynamic = "force-dynamic";

// 메인 화면 틀(왼쪽 라이브 커머스 플레이어 · 오른쪽 메뉴) 안에서 브랜드샵을 연다 (2026-11-14)
//  왼쪽 플레이어: 브랜드가 '샵 꾸미기'에서 넣은 라이브 커머스 영상 (없으면 메인 영상)
export default async function BrandShopPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const [shop, videos] = await Promise.all([
    prisma.brandShop.findUnique({ where: { id: params.id }, select: { name: true } }).catch(() => null),
    getBrandShopVideos(params.id).catch(() => null),
  ]);
  return (
    <>
      <StudioBroadcastRail videos={videos} title={shop ? `${shop.name} 라이브` : undefined} />
      <BrandStorefront id={params.id} searchParams={searchParams} base="/brands" frame="inline" />
    </>
  );
}
