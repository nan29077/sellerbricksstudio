// 주문 현황 화면(창고(스튜디오) · 셀러 · 최고관리자)에서 쓰는 주문 상세: 주문 상품 · 배송 담당 · 배송지
// 구매자 연락처 · 주소는 그 주문을 직접 출고하는 쪽과 최고관리자에게만 전부 보여 주고, 나머지는 가려서 보여 준다.
// (브랜드 직배송분의 배송지는 브랜드 발주서에 따로 전달된다)
import { maskAddress, maskName, maskPhone } from "./brands";
import { orderParts, shipperOf, type OrderActor, type OrderForFulfillment, type Shipper } from "./order-fulfillment";

export const SHIPPER_LABEL: Record<Shipper, string> = { BRAND: "브랜드 직배송", FACILITY: "창고 출고", SELLER: "셀러 출고" };

// 주문 목록 상태 필터
export const ORDER_FILTERS = [
  { key: "", label: "전체" },
  { key: "todo", label: "출고 대기" },
  { key: "shipping", label: "배송중" },
  { key: "done", label: "배송완료" },
  { key: "closed", label: "취소 · 환불" },
  { key: "claim", label: "구매자 요청" },
] as const;

export function orderFilterWhere(key: string | undefined) {
  switch (key) {
    case "todo": return { status: { in: ["PAID", "PREPARING"] as ("PAID" | "PREPARING")[] }, localShippedAt: null };
    case "shipping": return { OR: [{ status: "SHIPPED" as const }, { status: "PREPARING" as const, localShippedAt: { not: null } }] };
    case "done": return { status: "DELIVERED" as const };
    case "closed": return { status: { in: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] } };
    case "claim": return { claims: { some: { status: "REQUESTED" as const } } };
    default: return {};
  }
}

type OrderForDetail = Omit<OrderForFulfillment, "items" | "purchaseOrders"> & {
  buyerName: string; buyerPhone: string; buyerAddress?: string | null; shippingFee?: number | null; discountAmount?: number | null;
  deliveredAt?: Date | string | null; updatedAt?: Date | string | null;
  shipCarrier?: string | null; shipTrackingNumber?: string | null;
  items?: (OrderForFulfillment["items"][number] & { id: string; productName: string; optionLabel: string | null; quantity: number; lineTotal: number })[];
  purchaseOrders?: OrderForFulfillment["purchaseOrders"];
};

export type OrderDetailView = {
  lines: { id: string; name: string; option: string | null; quantity: number; lineTotal: number; cancelled: boolean; shipper: Shipper }[];
  shippingFee: number;
  discount?: number;
  shipTo: { name: string; phone: string; address: string; masked: boolean; note: string };
};

export function orderDetailProps(o: OrderForDetail, actor: OrderActor, piiRetentionDays: number): OrderDetailView {
  const items = o.items ?? [];
  const parts = orderParts({ ...o, items, purchaseOrders: o.purchaseOrders ?? [] });
  const ships = parts.localShipper === "FACILITY" ? actor.isFacilityOwner : parts.localShipper === "SELLER" ? actor.isSeller : false;
  const closedAt = o.localDeliveredAt ?? o.deliveredAt ?? (["CANCELLED", "REFUNDED"].includes(o.status as string) ? o.updatedAt : null);
  const expired = !!closedAt && Date.now() - new Date(closedAt).getTime() > piiRetentionDays * 86400000;
  const full = actor.isAdmin || (ships && !expired);
  const address = o.buyerAddress ?? "";
  const note = full ? ""
    : ships ? `배송 완료 ${piiRetentionDays}일이 지나 구매자 정보를 가렸습니다`
    : parts.localShipper === null && parts.hasBrand ? "브랜드 직배송 — 배송지는 브랜드 발주서로 전달됩니다"
    : parts.localShipper === "FACILITY" ? "창고(스튜디오)가 출고합니다 — 구매자 정보는 출고 담당에게만 보입니다"
    : "구매자 정보는 출고 담당에게만 보입니다";
  return {
    lines: items.map((i) => ({
      id: i.id, name: i.productName, option: i.optionLabel, quantity: i.quantity, lineTotal: i.lineTotal,
      cancelled: !!i.cancelledAt, shipper: shipperOf(o, i.liveSessionProduct),
    })),
    shippingFee: Math.max(0, o.shippingFee ?? 0),
    discount: Math.max(0, o.discountAmount ?? 0),
    shipTo: {
      name: full ? o.buyerName : maskName(o.buyerName), phone: full ? o.buyerPhone : maskPhone(o.buyerPhone),
      address: full ? address : maskAddress(address), masked: !full, note,
    },
  };
}
