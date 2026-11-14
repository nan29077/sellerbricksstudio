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
import { ShopImage } from "@/components/shop/shop-image";
import { brandArtworkFor } from "@/lib/brands";
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

export async function BuyerBrandFavorites({ user }: { user: SessionUser }) {
  const home = buyerHome(user.role);
  const rows = user.id.startsWith("demo-") ? [] : await prisma.brandProductFavorite.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" },
    include: { brandProduct: { select: { id: true, name: true, category: true, imageUrl: true, supplyPrice: true, consumerPrice: true, samplePrice: true, stock: true, isActive: true, shop: { select: { id: true, name: true, status: true } } } } },
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
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {rows.map(({ brandProduct: p }) => {
            const available = p.isActive && p.shop.status === "APPROVED";
            return (
              <li key={p.id} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <Link href={brandProductHref(p.shop.id, p.id, `${home}/brands`)} aria-label={`${p.name} 상품 보기`} className="group block aspect-square overflow-hidden bg-[#F4F0E9]">
                  <ShopImage src={p.imageUrl} fallback={brandArtworkFor(p.category)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
                </Link>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="truncate text-[11px] font-semibold text-slate-500">{p.shop.name}</p>
                  <Link href={brandProductHref(p.shop.id, p.id, `${home}/brands`)} className="line-clamp-2 break-keep text-sm font-bold text-navy hover:underline">{p.name}</Link>
                  <p className="text-xs font-semibold text-navy">공급 {formatKRW(p.supplyPrice)}{p.consumerPrice > 0 && <span className="font-normal text-slate-500"> · 권장 {formatKRW(p.consumerPrice)}</span>}</p>
                  <p className="text-[11px] text-slate-600">샘플 {p.samplePrice === null ? "미제공" : p.samplePrice === 0 ? "무료" : formatKRW(p.samplePrice)} · 재고 {p.stock}개</p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                    <BrandFavoriteButton productId={p.id} initial />
                    {imported.has(p.id) && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">내 방송 상품</span>}
                    {!available && <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">판매 중지</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
