import Link from "next/link";
import { CalendarPlus, PackageCheck, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { MiniStats } from "@/components/dashboard/kit";
import { EmptyState } from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { SellerListingRow } from "@/components/brand/seller-listing-row";
import { PriceLine, ProductCard, ProductGrid, ProductToolbar, ViewToggle, viewOf } from "@/components/shop/product-card";
import { sp, withParams, type SP } from "@/lib/list";
import { brandArtworkFor, brandProductHref, parseOptions } from "@/lib/brands";
import { readVariants } from "@/lib/brand-pricing";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import { defaultProfileImage } from "@/lib/profile";
import { cn, formatKRW } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 방송 상품 | 스토리지마켓" };

// 2026-11-14: 글자 목록 → 상품 사진 · 브랜드 로고가 들어간 카드형
const STATES = [
  { value: "", label: "전체" }, { value: "selling", label: "판매 중" }, { value: "paused", label: "판매 중지" }, { value: "unavailable", label: "판매 불가" },
] as const;

export default async function SellerBrandProducts({ searchParams }: { searchParams: SP }) {
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
  const view = viewOf(searchParams);
  const rows = listings.map((l) => ({ l, unavailable: !l.brandProduct.isActive || !l.brandProduct.allowDropship || l.brandProduct.shop.status !== "APPROVED" }));
  const keyOf = (r: (typeof rows)[number]) => r.unavailable ? "unavailable" : r.l.isActive ? "selling" : "paused";
  const counts: Record<string, number> = { all: rows.length, selling: 0, paused: 0, unavailable: 0 };
  for (const r of rows) counts[keyOf(r)]++;
  const state = STATES.find((x) => x.value === sp(searchParams, "state"))?.value ?? "";
  const shown = state ? rows.filter((r) => keyOf(r) === state) : rows;
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
      {listings.length === 0 ? <EmptyState title="아직 고른 브랜드 상품이 없어요" description="브랜드샵에서 '판매 상품으로 가져오기'를 누르면 여기에 모입니다. 샘플을 먼저 받아 볼 수도 있어요." /> : <>
        <ProductToolbar count={shown.length} toggle={<ViewToggle base="/seller/brand-products" params={searchParams} view={view} />}>
          <nav aria-label="판매 상태" className="flex gap-1 overflow-x-auto">
            {STATES.map((st) => (
              <Link key={st.value} href={withParams("/seller/brand-products", searchParams, { state: st.value || null })} scroll={false} aria-current={state === st.value ? "page" : undefined}
                className={cn("inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold transition", state === st.value ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
                {st.label}<span className={state === st.value ? "text-white/70" : "text-slate-400"}>{counts[st.value || "all"]}</span>
              </Link>
            ))}
          </nav>
        </ProductToolbar>
        {shown.length === 0 && <p className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-600">이 상태의 상품이 없어요.</p>}
        <ProductGrid view={view}>
          {shown.map(({ l, unavailable }) => {
            const bp = l.brandProduct;
            const artwork = generatedBrandProductArtwork(bp.shop.name, bp);
            const margin = Math.max(0, l.salePrice - bp.supplyPrice);
            const soldQty = soldMap.get(bp.id) ?? 0;
            const variantCount = readVariants(bp.optionVariants, parseOptions(bp.options)).filter((v) => v.extra || v.saleExtra || v.soldOut).length;
            const status = unavailable ? { label: "판매 불가", tone: "red" as const } : !l.isActive ? { label: "판매 중지", tone: "gray" as const } : { label: "판매 중", tone: "green" as const };
            const fixed = bp.priceRule === "FIXED" && bp.salePrice > 0;
            return (
              <ProductCard key={l.id} view={view} href={brandProductHref(bp.shop.id, bp.id, "/seller/brands")} dim={unavailable || !l.isActive}
                image={bp.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(bp.category)} title={bp.name}
                brand={{ name: bp.shop.name, logo: bp.shop.logoUrl, logoFallback: defaultProfileImage(`brand:${bp.shop.id}`), href: `/seller/brands/${bp.shop.id}` }}
                status={status} cover={bp.stock <= 0 ? "품절" : undefined}
                price={<PriceLine label="내 판매가" value={formatKRW(l.salePrice)} note={<>공급 {formatKRW(bp.supplyPrice)} · <b className="text-emerald-700">마진 {formatKRW(margin)}</b></>} />}
                aside={(
                  <dl className="grid w-60 grid-cols-3 gap-1 text-center">
                    <div className="rounded-lg bg-[#F9F7F2] px-1 py-1.5"><dt className="text-[10px] text-slate-500">판매가</dt><dd className="whitespace-nowrap text-xs font-black text-navy">{formatKRW(l.salePrice)}</dd></div>
                    <div className="rounded-lg bg-[#F9F7F2] px-1 py-1.5"><dt className="text-[10px] text-slate-500">마진</dt><dd className="whitespace-nowrap text-xs font-black text-emerald-700">{formatKRW(margin)}</dd></div>
                    <div className="rounded-lg bg-[#F9F7F2] px-1 py-1.5"><dt className="text-[10px] text-slate-500">판매</dt><dd className="whitespace-nowrap text-xs font-black text-navy">{soldQty.toLocaleString()}개</dd></div>
                  </dl>
                )}
                chips={[fixed && { label: "판매가 고정", tone: "navy" }, variantCount > 0 && { label: `옵션가 ${variantCount}`, tone: "violet" }, bp.stock > 0 && bp.stock <= 10 && { label: "재고 적음", tone: "amber" }]}
                meta={<>누적 판매 {soldQty.toLocaleString()}개 · 재고 {bp.stock.toLocaleString()}개</>}
                actions={<>
                  {l.isActive && !unavailable && <Link href={`/seller/bookings/new?brand=${bp.id}`} className={buttonVariants({ size: "sm", className: "h-9 w-full rounded-xl px-2 text-xs" })}><CalendarPlus className="mr-1 h-3.5 w-3.5" aria-hidden />방송 예약</Link>}
                  <details className="group/edit rounded-xl border border-slate-200 bg-white text-xs">
                    <summary className="flex h-9 cursor-pointer list-none items-center justify-center gap-1 font-bold text-slate-600 hover:text-navy"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />판매가 · 판매 설정</summary>
                    <div className="border-t border-slate-100 p-2">
                      <p className="mb-1.5 text-[10.5px] text-slate-500">{fixed ? "브랜드가 판매가를 고정했어요" : bp.salePrice > 0 ? `브랜드 권장 ${formatKRW(bp.salePrice)}` : `공급가 ${formatKRW(bp.supplyPrice)} 이상`}</p>
                      <SellerListingRow id={l.id} salePrice={l.salePrice} isActive={l.isActive} supplyPrice={bp.supplyPrice} fixed={fixed} />
                    </div>
                  </details>
                </>} />
            );
          })}
        </ProductGrid>
        <p className="flex items-center gap-1 text-[11px] text-slate-500"><PackageCheck className="h-3.5 w-3.5" aria-hidden />마진은 내 판매가 − 공급가이며, 플랫폼 수수료는 별도입니다.</p>
      </>}
    </div>
  );
}
