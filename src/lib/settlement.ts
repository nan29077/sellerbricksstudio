import type { CommissionType, FulfillmentMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcSellerCommission } from "@/lib/utils";
import { getPolicy, pct, type Policy } from "@/lib/policy";

// ---------------------------------------------------------------------------
// 판매 금액 나누기 (구매자 결제금 = 플랫폼 수수료 + 브랜드 공급대금 + 공간 몫 + 셀러 몫 + 배송비)
//  - 공간 상품 · 공급가 방식: 창고는 "셀러 공급가 × 수량"(브랜드 위탁 상품이면 그중 브랜드 공급대금을 뺀 나머지),
//    셀러는 판매가 − 판매 수수료 − 공급가
//  - 공간 상품 · 수수료 방식(예전 방식): 셀러는 상품에 정한 셀러 수수료, 나머지는 공간
//  - 셀러가 가져온 브랜드 직배송 상품: (판매가 − 공급가 − 판매 수수료) 중 셀러 몫 비율만큼 셀러, 나머지는 방송 장소
//  - 임시 상품: 셀러 수수료 없음 (기존 규칙)
//  - 배송비: 셀러가 방송마다 정하고, 실제로 택배를 보내는 쪽이 받는다 (판매 수수료 없음)
//      · 공간 방송에서 창고가 출고하는 상품(창고 상품 · 위탁 상품 · 임시 상품)이 있으면 → 공간 몫
//      · 그 밖(브랜드 직배송 상품만 있는 주문 · 셀러 공간 방송) → 셀러 몫. 브랜드 직배송 택배비는 브랜드 공급가에 포함된 것으로 본다
// 주문할 때 줄마다 계산해 OrderItem 에 저장한다. 이후 수수료율 · 공급가 · 셀러 수수료가 바뀌어도 이미 팔린 주문은 그대로다.
// ---------------------------------------------------------------------------
export type LineInput = {
  lineTotal: number; unitPrice: number; quantity: number;
  supplyPrice: number | null;        // 브랜드 상품이면 브랜드 공급가
  facilitySupply?: number | null;    // 공간이 정한 셀러 공급가 (공급가 방식)
  facilityCommission: { type: CommissionType; value: number } | null;
  sellerBrand: boolean;
  ownSpace?: boolean;                // 셀러 본인 공간 방송 (공간 없음) → 창고 몫도 셀러
};

export type LineSplit = { gross: number; platformFee: number; brand: number; facility: number; seller: number };

export function splitLine(line: LineInput, policy: Pick<Policy, "salesFeeRate" | "sellerShareRate">): LineSplit {
  const platformFee = pct(line.lineTotal, policy.salesFeeRate);
  const brand = line.supplyPrice != null ? line.supplyPrice * line.quantity : 0;
  const net = Math.max(0, line.lineTotal - platformFee - brand);
  let seller = 0;
  let facility: number;
  if (line.facilitySupply != null) {
    facility = Math.min(net, Math.max(0, line.facilitySupply * line.quantity - brand));
    seller = net - facility;
  } else {
    if (line.facilityCommission) seller = Math.min(net, calcSellerCommission(line.unitPrice, line.facilityCommission.type, line.facilityCommission.value) * line.quantity);
    else if (line.sellerBrand) seller = pct(net, policy.sellerShareRate);
    facility = net - seller;
  }
  if (line.ownSpace) { seller += facility; facility = 0; }
  return { gross: line.lineTotal, platformFee, brand, seller, facility };
}

// 방송 상품(LiveSessionProduct) 정보로 줄 계산 입력을 만든다. (방송에 올릴 때 남긴 스냅샷 우선)
export type LspForSplit = {
  brandProductId: string | null; supplyPriceSnapshot: number | null; fulfillment?: FulfillmentMode | null;
  facilitySupplySnapshot?: number | null; commissionTypeSnapshot?: CommissionType | null; commissionValueSnapshot?: number | null;
  facilityProduct: { commissionType: CommissionType; commissionValue: number; brandProductId: string | null; fulfillment?: FulfillmentMode | null } | null;
};

export function lineInputOf(lsp: LspForSplit, line: { lineTotal: number; unitPrice: number; quantity: number }, opts: { ownSpace?: boolean } = {}): LineInput {
  const fp = lsp.facilityProduct;
  const isBrand = !!(lsp.brandProductId ?? fp?.brandProductId);
  return {
    ...line,
    supplyPrice: isBrand ? lsp.supplyPriceSnapshot ?? 0 : null,
    facilitySupply: fp ? lsp.facilitySupplySnapshot ?? null : null,
    facilityCommission: fp ? { type: lsp.commissionTypeSnapshot ?? fp.commissionType, value: lsp.commissionValueSnapshot ?? fp.commissionValue } : null,
    sellerBrand: !fp && !!lsp.brandProductId,
    ownSpace: !!opts.ownSpace,
  };
}

const LSP_SELECT = {
  brandProductId: true, supplyPriceSnapshot: true, fulfillment: true, facilitySupplySnapshot: true, commissionTypeSnapshot: true, commissionValueSnapshot: true,
  facilityProduct: { select: { commissionType: true, commissionValue: true, brandProductId: true, fulfillment: true } },
} as const;

const ITEM_INCLUDE = {
  items: { include: { liveSessionProduct: { select: LSP_SELECT } } },
} as const;

type ItemForSplit = {
  lineTotal: number; unitPrice: number; quantity: number; cancelledAt?: Date | null; discountAmount?: number | null;
  platformFee?: number | null; brandAmount?: number | null; facilityAmount?: number | null; sellerAmount?: number | null;
  liveSessionProduct: LspForSplit;
};
type OrderForSplit = { shippingFee?: number | null; facilityId?: string | null; items: ItemForSplit[] };

/** 이 주문의 배송비를 받는 쪽: 공간 방송에서 창고가 직접 출고하는 상품이 있으면 창고, 아니면 셀러 */
export function shippingRecipient(order: OrderForSplit): "FACILITY" | "SELLER" {
  if (!order.facilityId) return "SELLER";
  const facilityShips = order.items.some((it) => {
    if (it.cancelledAt) return false;
    const lsp = it.liveSessionProduct;
    const brand = lsp.brandProductId ?? lsp.facilityProduct?.brandProductId ?? null;
    const mode = lsp.fulfillment ?? lsp.facilityProduct?.fulfillment ?? "DROPSHIP";
    return !(brand && mode !== "WAREHOUSE");
  });
  return facilityShips ? "FACILITY" : "SELLER";
}

/** 주문 줄 하나의 분배: 주문할 때 저장한 값이 있으면 그 값, 없으면(예전 주문) 지금 기준으로 계산 */
export function splitItem(it: ItemForSplit, policy: Policy): LineSplit {
  if (it.sellerAmount != null && it.facilityAmount != null && it.platformFee != null && it.brandAmount != null) {
    // 쿠폰 할인이 있으면 저장된 셀러 몫에서 이미 빠져 있다. 판매액도 실제 결제 기준으로 맞춘다.
    return { gross: it.lineTotal - Math.max(0, it.discountAmount ?? 0), platformFee: it.platformFee, brand: it.brandAmount, facility: it.facilityAmount, seller: it.sellerAmount };
  }
  return splitLine(lineInputOf(it.liveSessionProduct, it), policy);
}

/** 주문 전체 분배. includeShipping=false 면 배송비를 뺀다 (부분 취소 조정용) */
export function splitOrder(order: OrderForSplit, policy: Policy, opts: { includeShipping?: boolean } = {}) {
  const sum = { gross: 0, platformFee: 0, brand: 0, seller: 0, facility: 0, shipping: 0, shippingTo: shippingRecipient(order) };
  for (const it of order.items) {
    if (it.cancelledAt) continue; // 부분 취소된 줄은 정산에서 뺀다
    const r = splitItem(it, policy);
    sum.gross += r.gross; sum.platformFee += r.platformFee; sum.brand += r.brand; sum.seller += r.seller; sum.facility += r.facility;
  }
  const shipping = opts.includeShipping === false ? 0 : Math.max(0, order.shippingFee ?? 0);
  sum.gross += shipping; sum.shipping = shipping;
  if (sum.shippingTo === "FACILITY") sum.facility += shipping; else sum.seller += shipping;
  return sum;
}

// 주문 기반 정산 요약 (셀러 수익 · 공간 정산 · 플랫폼 수수료 · 브랜드 공급대금)
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

// 계정별 판매 수익 내역 (셀러 · 스토리지마켓 화면): 주문 줄마다 내 몫을 보여 준다.
export async function revenueLines(where: { sellerId?: string; facilityIds?: string[] }, take = 50) {
  const policy = await getPolicy();
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
      ...(where.sellerId && { sellerId: where.sellerId }),
      ...(where.facilityIds && { facilityId: { in: where.facilityIds } }),
    },
    orderBy: { createdAt: "desc" }, take,
    include: {
      ...ITEM_INCLUDE,
      liveSession: { select: { title: true } },
      facility: { select: { name: true } },
      seller: { select: { email: true, profile: { select: { name: true } } } },
    },
  });
  return orders.map((o) => {
    const lines = o.items.filter((i) => !i.cancelledAt).map((i) => ({ id: i.id, name: i.productName, quantity: i.quantity, lineTotal: i.lineTotal, ...splitItem(i, policy) }));
    const r = splitOrder(o, policy);
    return {
      id: o.id, orderNo: o.orderNo, status: o.status, createdAt: o.createdAt, title: o.liveSession.title,
      facilityName: (o.facility?.name ?? "셀러 공간"), sellerName: o.seller.profile?.name ?? o.seller.email, settled: !!o.settlementId,
      shipping: r.shipping, shippingTo: r.shippingTo, gross: r.gross, platformFee: r.platformFee, brand: r.brand, facility: r.facility, seller: r.seller, lines,
    };
  });
}

export { ITEM_INCLUDE as SETTLEMENT_ORDER_INCLUDE };
