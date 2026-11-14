import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_NAME } from "@/lib/site-brand";
import { BRAND_ARTWORK } from "@/lib/shop-artwork";
import { BrandStorefront } from "@/components/shop/brand-storefront";
import { StudioBroadcastRail } from "@/components/home/studio-broadcast-rail";
import { getBrandShopVideos } from "@/lib/home-videos";
import { MiniPlayerSource } from "@/components/home/mobile-mini-player";
import type { SP } from "@/lib/list";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const b = await prisma.brandShop.findUnique({ where: { id: params.id }, select: { name: true, tagline: true, status: true } }).catch(() => null);
  if (!b || b.status !== "APPROVED") return { title: `브랜드샵 | ${SITE_NAME}` };
  return { title: `${b.name} 브랜드샵 | ${SITE_NAME}`, description: b.tagline || undefined, openGraph: { title: `${b.name} | ${SITE_NAME}` } };
}

export const dynamic = "force-dynamic";

// 브랜드샵 '샵 바로가기' 화면 (2026-11-14) — 메인 화면 틀 안에서 그 브랜드답게 보여 준다
//  - PC 양옆 여백: 브랜드가 '샵 꾸미기'에서 고른 배경 (메인 배경 대신)
//  - 위쪽 머리글: 스토리지마켓 로고 대신 그 브랜드 로고 · 이름
//  - 왼쪽 플레이어: 그 브랜드가 넣은 라이브 커머스 영상 (여러 개면 옆으로 넘김, 없으면 안내만)
const cssUrl = (u: string) => `url("${u.replace(/["\\\n\r<>]/g, (c) => encodeURIComponent(c))}")`;

export default async function BrandShopPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const [shop, videos] = await Promise.all([
    prisma.brandShop.findUnique({ where: { id: params.id }, select: { id: true, name: true, logoUrl: true, backgroundUrl: true } }).catch(() => null),
    getBrandShopVideos(params.id).catch(() => null),
  ]);
  const background = shop?.backgroundUrl || BRAND_ARTWORK[4].url;
  return (
    <>
      {shop && (
        <>
          {/* 메인 화면 틀의 배경 자리를 이 브랜드 배경으로 (서버에서 바로 그려 깜빡임 없음) */}
          <style dangerouslySetInnerHTML={{ __html: `[data-studio-background]{background:#1a1a2e ${cssUrl(background)} center/cover no-repeat}[data-studio-background]>*{display:none}` }} />
          <StudioBroadcastRail own={videos ?? { LIVE_COMMERCE: [] }} title={`${shop.name} 라이브 커머스`} logo={shop.logoUrl}
            emptyText={`${shop.name}의 라이브 커머스 영상이 곧 올라와요.`} />
          <MiniPlayerSource id={shop.id} title={`${shop.name} 라이브 커머스`} videos={videos?.LIVE_COMMERCE ?? []} />
        </>
      )}
      <BrandStorefront id={params.id} searchParams={searchParams} base="/brands" frame="inline" studio />
    </>
  );
}
