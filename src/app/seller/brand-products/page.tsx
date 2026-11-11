import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SellerListingRow } from "@/components/brand/seller-listing-row";
import { getPolicy } from "@/lib/policy";
import { splitLine } from "@/lib/settlement";
import { formatKRW } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SellerBrandProducts() {
  const user = await requireRole(["SELLER"]);
  const [listings, policy, sold] = await Promise.all([
    prisma.sellerBrandProduct.findMany({
      where: { sellerId: user.id }, orderBy: { createdAt: "desc" },
      include: { brandProduct: { include: { shop: { select: { id: true, name: true, status: true } } } } },
    }),
    getPolicy(),
    prisma.purchaseOrderItem.groupBy({ by: ["brandProductId"], where: { purchaseOrder: { sellerId: user.id, status: { notIn: ["CANCELLED", "RETURNED"] } } }, _sum: { quantity: true } }),
  ]);
  const soldMap = new Map(sold.map((s) => [s.brandProductId, s._sum.quantity ?? 0]));
  return (
    <div className="space-y-5">
      <PageHeader title="내 브랜드 판매 상품" description="브랜드샵에서 가져온 직배송 상품입니다. 라이브 방송의 판매 상품 선택 → '브랜드 상품' 탭에서 바로 올릴 수 있고, 판매되면 발주서가 브랜드사로 자동 전달됩니다."
        action={<Link href="/brands" className={buttonVariants({ variant: "outline" })}>브랜드샵 둘러보기</Link>} />
      {listings.length === 0 ? <EmptyState title="가져온 브랜드 상품이 없습니다" description="브랜드샵에서 '판매 상품으로 가져오기'를 누르세요. 무료·유료 샘플을 먼저 받아 볼 수도 있습니다." /> : (
        <div className="space-y-3">
          {listings.map((l) => {
            const bp = l.brandProduct;
            const unavailable = !bp.isActive || !bp.allowDropship || bp.shop.status !== "APPROVED";
            const est = splitLine({ lineTotal: l.salePrice, unitPrice: l.salePrice, quantity: 1, supplyPrice: bp.supplyPrice, facilityCommission: null, sellerBrand: true }, policy);
            return (
              <article key={l.id} className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-500"><Link href={`/brands/${bp.shop.id}`} className="underline">{bp.shop.name}</Link> · {bp.category}</p>
                  <p className="font-black text-navy">{bp.name} {unavailable && <Badge tone="red">판매 불가</Badge>} {!l.isActive && <Badge tone="gray">판매 중지</Badge>}</p>
                  <p className="text-xs text-slate-600">공급가 {formatKRW(bp.supplyPrice)} · 브랜드 재고 {bp.stock.toLocaleString()}개 · 누적 판매 {(soldMap.get(bp.id) ?? 0).toLocaleString()}개</p>
                  <p className="text-xs text-slate-600">1개 팔면 예상 셀러 몫 <b className="text-navy">{formatKRW(est.seller)}</b> (판매 수수료 {policy.salesFeeRate}% · 셀러 몫 {policy.sellerShareRate}%, 나머지는 방송 장소)</p>
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
