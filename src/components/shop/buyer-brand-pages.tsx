import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { brandProductHref } from "@/lib/brands";
import { formatKRW } from "@/lib/utils";
import { sp, type SP } from "@/lib/list";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { buttonVariants } from "@/components/ui/button";
import { MessageCenter } from "@/components/brand/message-thread";
import { BrandRequestList } from "@/components/shop/brand-request-list";
import { BrandFavoriteButton } from "@/components/shop/brand-favorite-button";
import { brandArtworkFor } from "@/lib/brands";
import { priceBreakdown } from "@/lib/brand-pricing";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import { defaultProfileImage } from "@/lib/profile";
import { PriceLine, ProductCard, ProductGrid, ProductToolbar, ViewToggle, viewOf } from "@/components/shop/product-card";
import { runBrandRequestMaintenance } from "@/lib/brand-request-automation";

// 셀러(·최고관리자)의 브랜드 관련 화면 — 2026-11-14부터 각 대시보드 안에서 연다.
//  셀러: /seller/brand-messages · /seller/brand-requests · /seller/brand-favorites
//  최고관리자(창고 운영): /facility/brand-messages · /facility/brand-requests · /facility/brand-favorites
//  예전 주소(/brand-messages 등)는 역할에 맞는 대시보드 주소로 넘겨 준다.

export function buyerHome(role: string) {
  return role === "SELLER" ? "/seller" : "/facility";
}

function BrowseButton({ home }: { home: string }) {
  return <Link href={`${home}/brands`} className={buttonVariants({ variant: "outline" })}><ShoppingBag className="mr-1.5 h-4 w-4" aria-hidden />브랜드샵 둘러보기</Link>;
}

export async function BuyerBrandMessages({ user, searchParams }: { user: SessionUser; searchParams: SP }) {
  const home = buyerHome(user.role);
  const shopId = sp(searchParams, "shop");
  const startShop = shopId ? await prisma.brandShop.findFirst({ where: { id: shopId, status: "APPROVED" }, select: { id: true, name: true } }) : null;
  return (
    <div className="space-y-5">
      <PageHeader title="브랜드 문의" description="샘플 · 방송 시연품 · 재고 · 출고 일정을 브랜드와 1:1로 주고받아요. 브랜드샵 상품 화면의 '브랜드에 문의'로 새 대화를 시작할 수 있습니다."
        action={<BrowseButton home={home} />} />
      <MessageCenter side="PARTNER" scope={{ partnerId: user.id }} base={`${home}/brand-messages`} selected={sp(searchParams, "t")} startShop={startShop} me={user.id} />
    </div>
  );
}

export async function BuyerBrandRequests({ user, searchParams }: { user: SessionUser; searchParams: SP }) {
  const home = buyerHome(user.role);
  if (!user.id.startsWith("demo-")) await runBrandRequestMaintenance(); // 응대 기한 처리(1분에 한 번만 실제로 돈다)
  return (
    <div className="space-y-5">
      <PageHeader title={user.role === "SELLER" ? "샘플 · 시연품 신청 내역" : "샘플 · 입고 신청 내역"}
        description="브랜드에 보낸 샘플 신청과, 방송 예약 때 자동으로 요청된 방송 시연품의 진행 상황이에요. 시연품은 방송 2일 전까지 예약한 공간에 도착합니다."
        action={<BrowseButton home={home} />} />
      <BrandRequestList base={`${home}/brand-requests`} scope={{ buyerId: user.id }} manager={false} params={searchParams} />
    </div>
  );
}

export async function BuyerBrandFavorites({ user, searchParams = {} }: { user: SessionUser; searchParams?: SP }) {
  const home = buyerHome(user.role);
  const view = viewOf(searchParams);
  const rows = user.id.startsWith("demo-") ? [] : await prisma.brandProductFavorite.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" },
    include: { brandProduct: { select: { id: true, name: true, category: true, imageUrl: true, supplyPrice: true, consumerPrice: true, salePrice: true, samplePrice: true, sampleStock: true, stock: true, isActive: true, shop: { select: { id: true, name: true, status: true, logoUrl: true } } } } },
  });
  const imported = new Set(rows.length ? (user.role === "SELLER"
    ? await prisma.sellerBrandProduct.findMany({ where: { sellerId: user.id, brandProductId: { in: rows.map((r) => r.brandProductId) } }, select: { brandProductId: true } })
    : await prisma.facilityProduct.findMany({ where: { brandProductId: { in: rows.map((r) => r.brandProductId) } }, select: { brandProductId: true } })
  ).map((x) => x.brandProductId).filter(Boolean) as string[] : []);
  return (
    <div className="space-y-5">
      <PageHeader title="찜한 브랜드 상품" description="상품을 눌러 샘플을 신청하거나 방송 상품으로 가져오세요. 샘플 구매는 판매와 별개로 진행됩니다."
        action={<BrowseButton home={home} />} />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
          <Heart className="h-8 w-8 text-slate-300" aria-hidden />
          <p className="break-keep text-sm text-slate-600">아직 찜한 상품이 없어요. 브랜드샵에서 마음에 드는 상품의 &lsquo;찜하기&rsquo;를 눌러 보세요.</p>
        </div>
      ) : <>
        <ProductToolbar count={rows.length} toggle={<ViewToggle base={`${home}/brand-favorites`} params={searchParams} view={view} />} />
        <ProductGrid view={view}>
          {rows.map(({ brandProduct: p }) => {
            const available = p.isActive && p.shop.status === "APPROVED";
            const pb = priceBreakdown(p);
            const sample = p.samplePrice !== null && p.sampleStock > 0;
            const artwork = generatedBrandProductArtwork(p.shop.name, p);
            return (
              <ProductCard key={p.id} view={view} href={available ? brandProductHref(p.shop.id, p.id, `${home}/brands`) : undefined} dim={!available}
                image={p.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(p.category)} title={p.name}
                brand={{ name: p.shop.name, logo: p.shop.logoUrl, logoFallback: defaultProfileImage(`brand:${p.shop.id}`), href: available ? `${home}/brands/${p.shop.id}` : undefined }}
                status={!available ? { label: "판매 중지", tone: "gray" } : imported.has(p.id) ? { label: user.role === "SELLER" ? "내 방송 상품" : "판매 중", tone: "green" } : undefined}
                cover={available && p.stock <= 0 ? "품절" : undefined}
                price={<PriceLine label="공급" value={formatKRW(p.supplyPrice)} note={pb.sale > 0 ? `판매가 ${formatKRW(pb.sale)} · 마진 ${formatKRW(pb.sellerMargin)}` : p.consumerPrice > 0 ? `소비자가 ${formatKRW(p.consumerPrice)}` : undefined} />}
                chips={[sample ? { label: p.samplePrice === 0 ? "무료 샘플" : "유료 샘플", tone: "brand" } : { label: "샘플 없음", tone: "gray" }, available && p.stock > 0 && p.stock <= 10 && { label: "재고 적음", tone: "amber" }]}
                meta={<>재고 {p.stock.toLocaleString()}개</>}
                actions={<div className="flex items-center gap-1.5">
                  <BrandFavoriteButton productId={p.id} initial className="h-9 flex-1 justify-center rounded-xl text-xs" />
                </div>}
                hideDetail={!available} />
            );
          })}
        </ProductGrid>
      </>}
    </div>
  );
}
