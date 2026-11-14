import Link from "next/link";
import { CalendarPlus, PackageCheck, ShoppingBag, Store } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { MiniStats } from "@/components/dashboard/kit";
import { EmptyState } from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { SellerListingRow } from "@/components/brand/seller-listing-row";
import { ShopImage } from "@/components/shop/shop-image";
import { brandArtworkFor, brandProductHref } from "@/lib/brands";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import { defaultProfileImage } from "@/lib/profile";
import { cn, formatKRW } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 방송 상품 | 스토리지마켓" };

// 2026-11-14: 글자 목록 → 상품 사진 · 브랜드 로고가 들어간 카드형
export default async function SellerBrandProducts() {
  const user = await requireRole(["SELLER"]);
  const [listings, sold] = await Promise.all([
    prisma.sellerBrandProduct.findMany({
      where: { sellerId: user.id }, orderBy: { createdAt: "desc" },
      include: { brandProduct: { include: { shop: { select: { id: true, name: true, status: true, logoUrl: true } } } } },
    }),
    prisma.purchaseOrderItem.groupBy({ by: ["brandProductId"], where: { purchaseOrder: { sellerId: user.id, status: { notIn: ["CANCELLED", "RETURNED"] } } }, _sum: { quantity: true } }),
  ]);
  const soldMap = new Map(sold.map((s) => [s.brandProductId, s._sum.quantity ?? 0]));
  const selling = listings.filter((l) => l.isActive && l.brandProduct.isActive && l.brandProduct.allowDropship && l.brandProduct.shop.status === "APPROVED").length;
  const brandCount = new Set(listings.map((l) => l.brandProduct.shop.id)).size;
  const soldTotal = listings.reduce((s, l) => s + (soldMap.get(l.brandProduct.id) ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="내 방송 상품"
        description="브랜드샵에서 고른 위탁배송 상품이에요. 공간을 예약할 때 담으면 시연품이 방송 2일 전까지 그 공간으로 오고, 판매분은 주문서로 내면 브랜드가 고객에게 바로 보냅니다."
        action={<Link href="/seller/brands" className={buttonVariants({ variant: "outline" })}><ShoppingBag className="mr-1.5 h-4 w-4" aria-hidden />브랜드샵 둘러보기</Link>} />
      {listings.length > 0 && <MiniStats items={[
        { label: "고른 상품", value: `${listings.length.toLocaleString()}개` },
        { label: "판매 중", value: `${selling.toLocaleString()}개` },
        { label: "브랜드", value: `${brandCount.toLocaleString()}곳` },
        { label: "누적 판매", value: `${soldTotal.toLocaleString()}개` },
      ]} />}
      {listings.length === 0 ? <EmptyState title="아직 고른 브랜드 상품이 없어요" description="브랜드샵에서 '판매 상품으로 가져오기'를 누르면 여기에 모입니다. 샘플을 먼저 받아 볼 수도 있어요." /> : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((l) => {
            const bp = l.brandProduct;
            const unavailable = !bp.isActive || !bp.allowDropship || bp.shop.status !== "APPROVED";
            const artwork = generatedBrandProductArtwork(bp.shop.name, bp);
            const margin = Math.max(0, l.salePrice - bp.supplyPrice);
            const state = unavailable ? { label: "판매 불가", cls: "bg-red-600 text-white" } : !l.isActive ? { label: "판매 중지", cls: "bg-slate-700 text-white" } : { label: "판매 중", cls: "bg-emerald-600 text-white" };
            return (
              <li key={l.id} className={cn("flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm", (unavailable || !l.isActive) && "opacity-90")}>
                <Link href={brandProductHref(bp.shop.id, bp.id, "/seller/brands")} className="group relative block aspect-[4/3] overflow-hidden bg-slate-100" aria-label={`${bp.name} 상품 보기`}>
                  <ShopImage src={bp.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(bp.category)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
                  <span className={cn("absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm", state.cls)}>{state.label}</span>
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">{bp.category}</span>
                </Link>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <Link href={`/seller/brands/${bp.shop.id}`} className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600 hover:text-navy">
                    <ShopImage src={bp.shop.logoUrl} fallback={defaultProfileImage(`brand:${bp.shop.id}`)} alt="" className="h-7 w-7 shrink-0 rounded-lg border bg-white object-cover" />
                    <span className="truncate">{bp.shop.name}</span>
                    <Store className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  </Link>
                  <h2 className="line-clamp-2 break-keep text-base font-black leading-snug text-navy">{bp.name}</h2>
                  <dl className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-xl bg-[#F9F7F2] px-1.5 py-2"><dt className="text-[10px] font-semibold text-slate-500">공급가</dt><dd className="mt-0.5 truncate text-sm font-extrabold text-navy">{formatKRW(bp.supplyPrice)}</dd></div>
                    <div className="rounded-xl bg-[#F9F7F2] px-1.5 py-2"><dt className="text-[10px] font-semibold text-slate-500">1개당 남는 돈</dt><dd className="mt-0.5 truncate text-sm font-extrabold text-emerald-700">{formatKRW(margin)}</dd></div>
                    <div className="rounded-xl bg-[#F9F7F2] px-1.5 py-2"><dt className="text-[10px] font-semibold text-slate-500">누적 판매</dt><dd className="mt-0.5 truncate text-sm font-extrabold text-navy">{(soldMap.get(bp.id) ?? 0).toLocaleString()}개</dd></div>
                  </dl>
                  <p className="flex items-center gap-1 text-[11px] text-slate-500"><PackageCheck className="h-3.5 w-3.5" aria-hidden />브랜드 재고 {bp.stock.toLocaleString()}개 · 플랫폼 수수료는 별도</p>
                  <div className="mt-auto space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-semibold text-slate-500">내 판매가{bp.priceRule === "FIXED" && bp.salePrice > 0 ? " · 브랜드 고정" : bp.salePrice > 0 ? ` · 브랜드 권장 ${formatKRW(bp.salePrice)}` : ""}</p>
                    <SellerListingRow id={l.id} salePrice={l.salePrice} isActive={l.isActive} supplyPrice={bp.supplyPrice} fixed={bp.priceRule === "FIXED" && bp.salePrice > 0} />
                    {l.isActive && !unavailable && <Link href={`/seller/bookings/new?brand=${bp.id}`} className={buttonVariants({ size: "sm", className: "w-full" })}><CalendarPlus className="mr-1.5 h-4 w-4" aria-hidden />이 상품으로 방송 예약</Link>}
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
