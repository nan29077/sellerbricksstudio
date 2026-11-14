import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { facilityScope } from "@/lib/facility-owner";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { BrandOrderButton } from "@/components/shop/brand-order-button";
import { FULFILLMENT_LABEL, brandArtworkFor, brandProductHref } from "@/lib/brands";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import { defaultProfileImage } from "@/lib/profile";
import { PriceLine, ProductCard, ProductGrid, ProductToolbar, ViewToggle, viewOf } from "@/components/shop/product-card";
import type { SP } from "@/lib/list";
import { formatKRW } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FacilityBrandProducts({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  if (user.role !== "SUPER_ADMIN") redirect("/facility/products"); // 브랜드 거래(가져오기 · 입고 요청)는 최고관리자가 한다
  const view = viewOf(searchParams);
  const [rows, profile] = await Promise.all([
    prisma.facilityProduct.findMany({
      where: { facility: facilityScope(user), brandProductId: { not: null } }, orderBy: { createdAt: "desc" },
      include: {
        facility: { select: { name: true, address: true, contactPhone: true } }, product: { select: { name: true } },
        brandProduct: { select: { id: true, name: true, category: true, imageUrl: true, supplyPrice: true, stock: true, isActive: true, allowWarehouse: true, minOrderQty: true, shop: { select: { id: true, name: true, status: true, logoUrl: true } } } },
      },
    }),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { name: true, phone: true } }),
  ]);
  const openRequests = rows.length ? await prisma.brandRequest.groupBy({
    by: ["facilityProductId"], where: { kind: "SUPPLY", facilityProductId: { in: rows.map((r) => r.id) }, status: { in: ["PENDING", "APPROVED", "SHIPPED"] } },
    _sum: { quantity: true },
  }) : [];
  const pending = new Map(openRequests.map((r) => [r.facilityProductId, r._sum.quantity ?? 0]));
  const sold = rows.length ? await prisma.purchaseOrderItem.groupBy({
    by: ["brandProductId"], where: { purchaseOrder: { facilityId: { in: Array.from(new Set(rows.map((r) => r.facilityId))) }, status: { notIn: ["CANCELLED", "RETURNED"] } } }, _sum: { quantity: true },
  }) : [];
  const soldMap = new Map(sold.map((s) => [s.brandProductId, s._sum.quantity ?? 0]));

  return (
    <div className="space-y-5">
      <PageHeader title="브랜드 판매 상품 · 입고" description="브랜드샵에서 가져온 상품입니다. 직배송은 바로 판매되고, 창고 입고 상품은 브랜드에 입고를 요청해 받은 뒤 '입고 확인'하면 판매 재고가 늘어납니다."
        action={<div className="flex gap-2"><Link href="/facility/brands" className={buttonVariants({ variant: "outline" })}>브랜드샵 둘러보기</Link><Link href="/brand-requests?kind=SUPPLY" className={buttonVariants({ variant: "outline" })}>입고 요청 내역</Link></div>} />
      {rows.length === 0 ? <EmptyState title="가져온 브랜드 상품이 없습니다" description="브랜드샵에서 '판매 상품으로 가져오기'를 누르고 배송 방식을 고르세요." /> : (
        <>
        <ProductToolbar count={rows.length} toggle={<ViewToggle base="/facility/brand-products" params={searchParams} view={view} />} />
        <ProductGrid view={view}>
          {rows.map((fp) => {
            const bp = fp.brandProduct!;
            const warehouse = fp.fulfillment === "WAREHOUSE";
            const artwork = generatedBrandProductArtwork(bp.shop.name, bp);
            const inbound = pending.get(fp.id) ?? 0;
            return (
              <ProductCard key={fp.id} view={view} href={brandProductHref(bp.shop.id, bp.id, "/facility/brands")} dim={!fp.isSellable}
                image={bp.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(bp.category)} title={fp.product.name}
                brand={{ name: bp.shop.name, logo: bp.shop.logoUrl, logoFallback: defaultProfileImage(`brand:${bp.shop.id}`), href: `/facility/brands/${bp.shop.id}` }}
                status={fp.isSellable ? { label: "판매 중", tone: "green" } : { label: "판매 대기", tone: "amber" }}
                subtitle={fp.facility.name}
                price={<PriceLine label="판매가" value={formatKRW(fp.salePrice)} note={<>공급 {formatKRW(bp.supplyPrice)} · <b className="text-emerald-700">마진 {formatKRW(Math.max(0, fp.salePrice - bp.supplyPrice))}</b></>} />}
                chips={[{ label: FULFILLMENT_LABEL[fp.fulfillment ?? "DROPSHIP"], tone: warehouse ? "violet" : "blue" }, warehouse && inbound > 0 && { label: `입고 중 ${inbound.toLocaleString()}개`, tone: "brand" }]}
                meta={<>{warehouse ? `창고 재고 ${fp.stock.toLocaleString()}개` : `판매 한도 ${fp.stock.toLocaleString()}개 · 브랜드 재고 ${bp.stock.toLocaleString()}개`} · 누적 판매 {(soldMap.get(bp.id) ?? 0).toLocaleString()}개</>}
                actions={<>
                  {warehouse && bp.isActive && bp.allowWarehouse && bp.shop.status === "APPROVED" && (
                    <BrandOrderButton productId={bp.id} name={bp.name} kind="SUPPLY" unitPrice={bp.supplyPrice} stock={bp.stock} minQuantity={bp.minOrderQty} facilityProductId={fp.id}
                      defaults={{ recipient: fp.facility.name, phone: fp.facility.contactPhone ?? profile?.phone ?? "", address: fp.facility.address }} />
                  )}
                  <Link href="/facility/products" className={buttonVariants({ variant: "outline", size: "sm", className: "h-9 w-full rounded-xl text-xs" })}>가격 · 수수료 수정</Link>
                </>} />
            );
          })}
        </ProductGrid>
        </>
      )}
    </div>
  );
}
