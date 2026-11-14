import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SellerListingRow } from "@/components/brand/seller-listing-row";
import { formatKRW } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SellerBrandProducts() {
  const user = await requireRole(["SELLER"]);
  const [listings, sold] = await Promise.all([
    prisma.sellerBrandProduct.findMany({
      where: { sellerId: user.id }, orderBy: { createdAt: "desc" },
      include: { brandProduct: { include: { shop: { select: { id: true, name: true, status: true } } } } },
    }),
    prisma.purchaseOrderItem.groupBy({ by: ["brandProductId"], where: { purchaseOrder: { sellerId: user.id, status: { notIn: ["CANCELLED", "RETURNED"] } } }, _sum: { quantity: true } }),
  ]);
  const soldMap = new Map(sold.map((s) => [s.brandProductId, s._sum.quantity ?? 0]));
  return (
    <div className="space-y-5">
      <PageHeader title="내 브랜드 판매 상품" description="브랜드샵에서 고른 위탁배송 상품입니다. 외부 플랫폼에서 판매한 뒤 '주문서 작성'에 담으면, 공급가 결제와 함께 발주서가 브랜드사로 자동 전달됩니다."
        action={<Link href="/brands" className={buttonVariants({ variant: "outline" })}>브랜드샵 둘러보기</Link>} />
      {listings.length === 0 ? <EmptyState title="가져온 브랜드 상품이 없습니다" description="브랜드샵에서 '판매 상품으로 가져오기'를 누르세요. 무료·유료 샘플을 먼저 받아 볼 수도 있습니다." /> : (
        <div className="space-y-3">
          {listings.map((l) => {
            const bp = l.brandProduct;
            const unavailable = !bp.isActive || !bp.allowDropship || bp.shop.status !== "APPROVED";
            return (
              <article key={l.id} className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-500"><Link href={`/brands/${bp.shop.id}`} className="underline">{bp.shop.name}</Link> · {bp.category}</p>
                  <p className="font-black text-navy">{bp.name} {unavailable && <Badge tone="red">판매 불가</Badge>} {!l.isActive && <Badge tone="gray">판매 중지</Badge>}</p>
                  <p className="text-xs text-slate-600">공급가 {formatKRW(bp.supplyPrice)} · 브랜드 재고 {bp.stock.toLocaleString()}개 · 누적 판매 {(soldMap.get(bp.id) ?? 0).toLocaleString()}개</p>
                  <p className="text-xs text-slate-600">외부 판매가 기준 1개당 남는 금액 약 <b className="text-navy">{formatKRW(Math.max(0, l.salePrice - bp.supplyPrice))}</b> (주문서 결제는 공급가만 · 플랫폼 수수료는 셀러가 쓰는 판매 플랫폼 기준)</p>
                </div>
                <SellerListingRow id={l.id} salePrice={l.salePrice} isActive={l.isActive} supplyPrice={bp.supplyPrice} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
