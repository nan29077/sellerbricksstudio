// 서버 컴포넌트(주문 목록 페이지)에서 쓰는 헬퍼 — "use client" 파일 밖에 두어야 서버에서 호출할 수 있음
// 주문 목록 쿼리에 붙일 include (부분 취소 · 출고 불가 요청 표시에 필요)
export const ORDER_ACTION_INCLUDE = {
  items: { select: { id: true, productName: true, optionLabel: true, quantity: true, lineTotal: true, cancelledAt: true, poItems: { select: { purchaseOrderId: true } } } },
} as const;

type IncludedOrder = {
  id: string; status: string; refundedAmount?: number;
  items?: { id: string; productName: string; optionLabel: string | null; quantity: number; lineTotal: number; cancelledAt: Date | null; poItems: { purchaseOrderId: string }[] }[];
  purchaseOrders?: { id?: string; poNo?: string; status: string; cancelRequestedAt?: Date | null; cancelRequestReason?: string; brandShop: { name: string } }[];
};
export function orderActionProps(o: IncludedOrder) {
  return {
    orderId: o.id, status: o.status, refundedAmount: o.refundedAmount ?? 0,
    items: (o.items ?? []).map((i) => ({ id: i.id, productName: i.productName, optionLabel: i.optionLabel, quantity: i.quantity, lineTotal: i.lineTotal, cancelledAt: i.cancelledAt, poId: i.poItems[0]?.purchaseOrderId ?? null })),
    cancelRequests: (o.purchaseOrders ?? []).filter((p) => p.cancelRequestedAt && p.id && (p.status === "NEW" || p.status === "CONFIRMED"))
      .map((p) => ({ poId: p.id!, poNo: p.poNo ?? "", brand: p.brandShop.name, reason: p.cancelRequestReason ?? "" })),
  };
}
