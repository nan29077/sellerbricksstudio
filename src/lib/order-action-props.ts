// 서버 컴포넌트(주문 목록 페이지)에서 쓰는 헬퍼 — "use client" 파일 밖에 두어야 서버에서 호출할 수 있음
import { FULFILLMENT_ITEM_SELECT, orderActions, type OrderActor, type OrderForFulfillment } from "./order-fulfillment";

// 주문 목록 쿼리에 붙일 include (부분 취소 · 출고 불가 요청 · 배송 담당 판정에 필요)
export const ORDER_ACTION_INCLUDE = {
  items: {
    select: {
      id: true, productName: true, optionLabel: true, quantity: true, lineTotal: true, poItems: { select: { purchaseOrderId: true } },
      ...FULFILLMENT_ITEM_SELECT,
    },
  },
  // 구매자 취소 · 반품 · 교환 요청 (주문 카드에 표시)
  claims: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, type: true, status: true, reason: true, detail: true, answer: true, createdAt: true } },
} as const;

type IncludedOrder = Omit<OrderForFulfillment, "items" | "purchaseOrders"> & {
  id: string; refundedAmount?: number; shipCarrier?: string | null; shipTrackingNumber?: string | null;
  items?: (OrderForFulfillment["items"][number] & { id: string; productName: string; optionLabel: string | null; quantity: number; lineTotal: number; poItems: { purchaseOrderId: string }[] })[];
  purchaseOrders?: { id?: string; poNo?: string; status: string; fulfillment: string; cancelRequestedAt?: Date | null; cancelRequestReason?: string; brandShop: { name: string } }[];
};

export function orderActionProps(o: IncludedOrder, actor: OrderActor) {
  const items = o.items ?? [];
  const actions = orderActions({ ...o, items, purchaseOrders: o.purchaseOrders ?? [] }, actor);
  return {
    orderId: o.id, status: o.status as string, refundedAmount: o.refundedAmount ?? 0, actions,
    items: items.map((i) => ({ id: i.id, productName: i.productName, optionLabel: i.optionLabel, quantity: i.quantity, lineTotal: i.lineTotal, cancelledAt: i.cancelledAt, poId: i.poItems[0]?.purchaseOrderId ?? null })),
    cancelRequests: (o.purchaseOrders ?? []).filter((p) => p.cancelRequestedAt && p.id && (p.status === "NEW" || p.status === "CONFIRMED"))
      .map((p) => ({ poId: p.id!, poNo: p.poNo ?? "", brand: p.brandShop.name, reason: p.cancelRequestReason ?? "" })),
  };
}
