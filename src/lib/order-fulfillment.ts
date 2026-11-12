import type { FulfillmentMode, OrderStatus, Prisma, PurchaseOrderStatus } from "@prisma/client";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// 주문 배송 담당 나누기
//  - 브랜드 직배송 상품 → 브랜드 (발주서에서 출고 · 운송장 · 배송 완료)
//  - 창고(스튜디오) 방송의 창고 상품 · 창고 위탁 상품 · 임시 상품 → 창고(스튜디오) (주문에서 직접 출고)
//  - 셀러 공간 방송의 임시 상품 → 셀러 (주문에서 직접 출고)
// 셀러는 창고(스튜디오) 방송 주문의 배송 상태를 바꾸지 못하고 확인만 한다. (출고 전 취소만 가능)
// ---------------------------------------------------------------------------
export type Shipper = "BRAND" | "FACILITY" | "SELLER";

type LspLike = {
  brandProductId: string | null; fulfillment: FulfillmentMode | null; source?: string;
  facilityProduct: { brandProductId: string | null; fulfillment: FulfillmentMode | null } | null;
};
export type OrderForFulfillment = {
  status: OrderStatus | string; facilityId: string | null; sellerId: string;
  localShippedAt: Date | string | null; localDeliveredAt: Date | string | null;
  items: { cancelledAt: Date | string | null; liveSessionProduct: LspLike }[];
  purchaseOrders: { status: PurchaseOrderStatus | string; fulfillment: FulfillmentMode | string }[];
};

export const FULFILLMENT_ITEM_SELECT = {
  cancelledAt: true,
  liveSessionProduct: { select: { brandProductId: true, fulfillment: true, source: true, facilityProduct: { select: { brandProductId: true, fulfillment: true } } } },
} as const;

export function shipperOf(order: { facilityId: string | null }, lsp: LspLike): Shipper {
  const brand = lsp.brandProductId ?? lsp.facilityProduct?.brandProductId ?? null;
  const mode = lsp.fulfillment ?? lsp.facilityProduct?.fulfillment ?? "DROPSHIP";
  if (brand && mode !== "WAREHOUSE") return "BRAND";
  return order.facilityId ? "FACILITY" : "SELLER";
}

export function orderParts(order: OrderForFulfillment) {
  const open = order.items.filter((i) => !i.cancelledAt);
  const shippers = new Set(open.map((i) => shipperOf(order, i.liveSessionProduct)));
  const localShipper: "FACILITY" | "SELLER" | null = shippers.has("FACILITY") ? "FACILITY" : shippers.has("SELLER") ? "SELLER" : null;
  const brandShipped = order.purchaseOrders.some((p) => ["SHIPPED", "DELIVERED", "RETURNED"].includes(p.status as string));
  return {
    hasLocal: !!localShipper, localShipper, hasBrand: shippers.has("BRAND"),
    anyShipped: !!order.localShippedAt || brandShipped,
    // 주문 운영자: 창고(스튜디오) 방송이면 창고, 셀러 공간 방송이면 셀러 (출고 후 환불 담당)
    operator: (order.facilityId ? "FACILITY" : "SELLER") as "FACILITY" | "SELLER",
  };
}

export type OrderActor = { isAdmin: boolean; isSeller: boolean; isFacilityOwner: boolean };

export type OrderActions = {
  statuses: ("PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED")[];
  canCancel: boolean;   // 출고 전 취소 (전체 · 부분)
  canRefund: boolean;   // 출고 후 환불 (전체 · 부분)
  isShipper: boolean;   // 직접 출고분 배송 상태를 바꿀 수 있는지
  localShipper: "FACILITY" | "SELLER" | null;
};

export function orderActions(order: OrderForFulfillment, actor: OrderActor): OrderActions {
  const p = orderParts(order);
  const open = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"].includes(order.status as string);
  const isOperator = actor.isAdmin || (p.operator === "FACILITY" ? actor.isFacilityOwner : actor.isSeller);
  const isShipper = p.hasLocal && (actor.isAdmin || (p.localShipper === "FACILITY" ? actor.isFacilityOwner : actor.isSeller));
  const statuses: OrderActions["statuses"] = [];
  if (open && isShipper) {
    if (order.status === "PAID") statuses.push("PREPARING");
    if (!order.localShippedAt && ["PAID", "PREPARING"].includes(order.status as string)) statuses.push("SHIPPED");
    if (order.localShippedAt && !order.localDeliveredAt) statuses.push("DELIVERED");
  }
  const canCancel = open && !p.anyShipped && ["PAID", "PREPARING"].includes(order.status as string) && (isOperator || actor.isSeller);
  // 출고 후 환불: 창고(스튜디오) 방송은 창고. 셀러 공간 방송은 셀러가 직접 출고한 주문만 셀러가 하고,
  // 브랜드가 이미 보낸 상품이 있으면 (반품 확인 · 브랜드 정산 차감이 걸리므로) 최고관리자가 처리한다.
  const sellerOwnShip = p.operator === "SELLER" && actor.isSeller && !p.hasBrand && !order.purchaseOrders.length;
  const canRefund = open && p.anyShipped && (actor.isAdmin || (p.operator === "FACILITY" ? actor.isFacilityOwner : sellerOwnShip));
  if (canCancel) statuses.push("CANCELLED");
  if (canRefund) statuses.push("REFUNDED");
  return { statuses, canCancel, canRefund, isShipper, localShipper: p.localShipper };
}

// ---------------------------------------------------------------------------
// 주문 전체 상태 맞추기: 직접 출고분 + 브랜드 직배송 발주서가 모두 출고되면 '배송중', 모두 배송 완료되면 '배송완료'
// (일부만 출고된 경우 결제완료 → 준비중으로만 바꾼다)
// ---------------------------------------------------------------------------
export async function refreshOrderStatusInTx(tx: Tx, orderId: string): Promise<OrderStatus | null> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, status: true, facilityId: true, sellerId: true, localShippedAt: true, localDeliveredAt: true,
      items: { select: FULFILLMENT_ITEM_SELECT },
      purchaseOrders: { select: { status: true, fulfillment: true } },
    },
  });
  if (!order || !["PAID", "PREPARING", "SHIPPED"].includes(order.status)) return null;
  const parts = orderParts(order);
  const states: { shipped: boolean; delivered: boolean }[] = [];
  if (parts.hasLocal) states.push({ shipped: !!order.localShippedAt, delivered: !!order.localDeliveredAt });
  for (const po of order.purchaseOrders) {
    if (po.fulfillment !== "DROPSHIP" || po.status === "CANCELLED" || po.status === "RETURNED") continue;
    states.push({ shipped: po.status === "SHIPPED" || po.status === "DELIVERED", delivered: po.status === "DELIVERED" });
  }
  if (!states.length) return null;
  let next: OrderStatus | null = null;
  if (states.every((s) => s.delivered)) next = "DELIVERED";
  else if (states.every((s) => s.shipped)) next = order.status === "SHIPPED" ? null : "SHIPPED";
  else if (states.some((s) => s.shipped) && order.status === "PAID") next = "PREPARING";
  if (!next || next === order.status) return null;
  await tx.order.update({ where: { id: order.id }, data: { status: next, ...(next === "DELIVERED" && { deliveredAt: new Date() }) } });
  return next;
}
