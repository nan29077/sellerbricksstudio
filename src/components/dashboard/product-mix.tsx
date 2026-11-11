import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { reportDbError } from "@/lib/db-error";
import { kstStartOfMonth } from "@/lib/kst";
import { SOLD_ORDER_STATUSES, compactKRW } from "@/lib/dashboard";
import { Donut, Empty, MiniStats, Panel } from "./kit";
import { ShoppingBag } from "lucide-react";

/**
 * 판매 상품을 출처별로 구분해 보여 준다.
 *  - 브랜드샵 상품   : 브랜드사 상품을 가져와 판매 (발주서가 브랜드로 전달)
 *  - 창고(스튜디오) 상품 : 창고가 직접 등록한 상품
 *  - 방송 임시 상품  : 방송 중 바로 추가한 상품
 * 데이터 로딩에 실패해도 대시보드 전체가 멈추지 않도록 자체적으로 오류를 처리한다.
 */
export async function ProductMixPanel({ scope }: { scope: { sellerId: string } | { facilityIds: string[] } }) {
  const seller = "sellerId" in scope;
  try {
    const monthStart = kstStartOfMonth(new Date());
    const orderWhere = { status: { in: [...SOLD_ORDER_STATUSES] }, createdAt: { gte: monthStart }, ...(seller ? { sellerId: scope.sellerId } : { facilityId: { in: scope.facilityIds } }) };
    const [items, listed, samples] = await Promise.all([
      prisma.orderItem.findMany({
        where: { order: orderWhere },
        select: { lineTotal: true, liveSessionProduct: { select: { brandProductId: true, source: true, facilityProduct: { select: { brandProductId: true } } } } },
      }),
      seller
        ? prisma.sellerBrandProduct.count({ where: { sellerId: scope.sellerId, isActive: true } })
        : prisma.facilityProduct.count({ where: { facilityId: { in: scope.facilityIds }, brandProductId: { not: null } } }),
      seller
        ? prisma.brandRequest.count({ where: { buyerId: scope.sellerId, status: { in: ["PENDING", "AWAITING_PAYMENT", "APPROVED", "SHIPPED"] } } })
        : prisma.facilityProduct.count({ where: { facilityId: { in: scope.facilityIds }, brandProductId: null } }),
    ]);
    let brand = 0, own = 0, temp = 0;
    for (const it of items) {
      const lsp = it.liveSessionProduct;
      if (lsp.brandProductId || lsp.facilityProduct?.brandProductId) brand += it.lineTotal;
      else if (lsp.source === "CATALOG") own += it.lineTotal;
      else temp += it.lineTotal;
    }
    const total = brand + own + temp;
    const brandLink = seller ? "/seller/brand-products" : "/facility/brand-products";
    return (
      <Panel eyebrow="PRODUCT MIX" title="상품 구분별 이번 달 판매" action={{ href: brandLink, label: "브랜드 상품" }}>
        {total === 0 ? <Empty icon={ShoppingBag} text="이번 달 판매가 생기면 브랜드샵 상품과 창고(스튜디오) 상품 판매를 나눠 보여 드립니다" action={{ href: "/brands", label: "브랜드샵 둘러보기" }} /> : (
          <Donut centerValue={compactKRW(total)} centerLabel="이번 달 판매" segments={[
            { label: "브랜드샵 상품", value: brand, tone: "violet" as const },
            { label: "창고(스튜디오) 상품", value: own, tone: "brand" as const },
            { label: "방송 임시 상품", value: temp, tone: "slate" as const },
          ].filter((s) => s.value > 0)} />
        )}
        <MiniStats className="mt-4 !grid-cols-2" items={seller ? [
          { label: "판매 중인 브랜드 상품", value: `${listed}개` },
          { label: "진행 중인 샘플 신청", value: `${samples}건` },
        ] : [
          { label: "판매 목록의 브랜드 상품", value: `${listed}개` },
          { label: "직접 등록한 상품", value: `${samples}개` },
        ]} />
        <p className="mt-3 text-[11px] text-slate-400">브랜드샵 상품은 판매되면 발주서가 브랜드사로 자동 전달됩니다. <Link href="/brand-requests" className="underline">샘플 · 입고 신청 내역</Link></p>
      </Panel>
    );
  } catch (e) {
    reportDbError("product-mix", e);
    return null;
  }
}
