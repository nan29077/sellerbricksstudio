import type { CommissionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcSellerCommission } from "@/lib/utils";
import { getPolicy, pct, type Policy } from "@/lib/policy";

// ---------------------------------------------------------------------------
// 판매 금액 나누기 (구매자 결제금 = 플랫폼 수수료 + 브랜드 공급대금 + 셀러 몫 + 창고(스튜디오) 몫)
//  - 창고(스튜디오) 상품: 셀러는 상품에 정한 셀러 수수료, 나머지는 창고(스튜디오)
//  - 셀러가 가져온 브랜드 직배송 상품: (판매가 - 공급가 - 플랫폼 수수료) 중 셀러 몫 비율만큼 셀러, 나머지는 방송 장소
//  - 임시 상품: 셀러 수수료 없음 (기존 규칙)
// ---------------------------------------------------------------------------
export type LineInput = {
  lineTotal: number; unitPrice: number; quantity: number;
  supplyPrice: number | null; // 브랜드 상품이면 공급가
  facilityCommission: { type: CommissionType; value: number } | null;
  sellerBrand: boolean;
};

export function splitLine(line: LineInput, policy: Policy) {
  const platformFee = pct(line.lineTotal, policy.salesFeeRate);
  const brand = line.supplyPrice != null ? line.supplyPrice * line.quantity : 0;
  const net = Math.max(0, line.lineTotal - platformFee - brand);
  let seller = 0;
  if (line.facilityCommission) seller = Math.min(net, calcSellerCommission(line.unitPrice, line.facilityCommission.type, line.facilityCommission.value) * line.quantity);
  else if (line.sellerBrand) seller = pct(net, policy.sellerShareRate);
  return { gross: line.lineTotal, platformFee, brand, seller, facility: net - seller };
}

const ITEM_INCLUDE = {
  items: { include: { liveSessionProduct: { select: { brandProductId: true, supplyPriceSnapshot: true, facilityProduct: { select: { commissionType: true, commissionValue: true, brandProductId: true } } } } } },
} as const;

type OrderWithItems = { items: { lineTotal: number; unitPrice: number; quantity: number; cancelledAt?: Date | null; liveSessionProduct: { brandProductId: string | null; supplyPriceSnapshot: number | null; facilityProduct: { commissionType: CommissionType; commissionValue: number; brandProductId: string | null } | null } }[] };

export function splitOrder(order: OrderWithItems, policy: Policy) {
  const sum = { gross: 0, platformFee: 0, brand: 0, seller: 0, facility: 0 };
  for (const it of order.items) {
    if (it.cancelledAt) continue; // 부분 취소된 줄은 정산에서 뺀다
    const lsp = it.liveSessionProduct;
    const fp = lsp.facilityProduct;
    const isBrand = !!(lsp.brandProductId ?? fp?.brandProductId);
    const r = splitLine({
      lineTotal: it.lineTotal, unitPrice: it.unitPrice, quantity: it.quantity,
      supplyPrice: isBrand ? lsp.supplyPriceSnapshot ?? 0 : null,
      facilityCommission: fp ? { type: fp.commissionType, value: fp.commissionValue } : null,
      sellerBrand: !fp && !!lsp.brandProductId,
    }, policy);
    sum.gross += r.gross; sum.platformFee += r.platformFee; sum.brand += r.brand; sum.seller += r.seller; sum.facility += r.facility;
  }
  return sum;
}

// 주문 기반 정산 요약 (셀러 수익 · 창고(스튜디오) 정산 · 플랫폼 수수료 · 브랜드 공급대금)
export async function computeSettlement(where: { sellerId?: string; facilityId?: string; facilityIds?: string[] }) {
  const policy = await getPolicy();
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
      ...(where.sellerId && { sellerId: where.sellerId }),
      ...(where.facilityId && { facilityId: where.facilityId }),
      ...(where.facilityIds && { facilityId: { in: where.facilityIds } }),
    },
    include: ITEM_INCLUDE,
  });
  const total = { gross: 0, platformFee: 0, brand: 0, seller: 0, facility: 0 };
  for (const o of orders) {
    const r = splitOrder(o, policy);
    total.gross += r.gross; total.platformFee += r.platformFee; total.brand += r.brand; total.seller += r.seller; total.facility += r.facility;
  }
  return { orderCount: orders.length, gross: total.gross, sellerProfit: total.seller, facilityAmount: total.facility, platformFee: total.platformFee, brandAmount: total.brand };
}

export { ITEM_INCLUDE as SETTLEMENT_ORDER_INCLUDE };
