// 구매자 취소 · 반품 · 교환 요청 규칙
//  - 취소: 아직 아무것도 출고되지 않은 결제 완료 · 상품 준비 중 주문
//  - 반품 · 교환: 출고된 주문 (배송 완료 후 RETURN_WINDOW_DAYS 일 이내)
//  - 처리 중인 요청은 한 주문에 하나만
// 요청은 '접수'만 한다. 실제 취소 · 환불은 판매자가 주문 화면의 기존 버튼(취소 · 부분 취소 · 환불)으로 처리한다.
import { orderParts, type OrderForFulfillment } from "./order-fulfillment";

export const CLAIM_LABEL = { CANCEL: "주문 취소", RETURN: "반품", EXCHANGE: "교환" } as const;
export const CLAIM_STATUS_LABEL = {
  REQUESTED: { label: "판매자 확인 중", tone: "yellow" },
  RESOLVED: { label: "처리 완료", tone: "green" },
  REJECTED: { label: "처리 불가", tone: "red" },
  WITHDRAWN: { label: "요청 철회", tone: "gray" },
} as const;
export type ClaimType = keyof typeof CLAIM_LABEL;
export const CLAIM_REASONS: Record<ClaimType, string[]> = {
  CANCEL: ["단순 변심", "주문 실수 (상품 · 옵션 · 수량)", "배송지 변경이 필요해요", "기타"],
  RETURN: ["단순 변심", "상품이 파손 · 불량이에요", "주문과 다른 상품이 왔어요", "기타"],
  EXCHANGE: ["사이즈 · 색상 변경", "상품이 파손 · 불량이에요", "주문과 다른 상품이 왔어요", "기타"],
};
export const RETURN_WINDOW_DAYS = 30;

type OrderLike = OrderForFulfillment & { deliveredAt?: Date | string | null; claims?: { status: string }[] };

/** 지금 구매자가 남길 수 있는 요청 종류. 못 남기면 이유를 함께 돌려준다. */
export function claimOptions(o: OrderLike, now = Date.now()): { types: ClaimType[]; reason: string | null } {
  if (o.claims?.some((c) => c.status === "REQUESTED")) return { types: [], reason: "판매자가 확인 중인 요청이 있습니다. 답변 후 다시 요청할 수 있어요." };
  if (o.status === "CANCELLED" || o.status === "REFUNDED") return { types: [], reason: "취소 · 환불이 끝난 주문입니다." };
  if (o.status === "ORDER_CREATED" || o.status === "PAYMENT_PENDING") return { types: [], reason: "결제가 끝나지 않은 주문입니다." };
  if (!o.items.some((i) => !i.cancelledAt)) return { types: [], reason: "모든 상품이 취소된 주문입니다." };
  const shipped = orderParts(o).anyShipped || o.status === "SHIPPED" || o.status === "DELIVERED";
  if (!shipped) return { types: ["CANCEL"], reason: null };
  const delivered = o.deliveredAt ?? o.localDeliveredAt;
  if (delivered && now - new Date(delivered).getTime() > RETURN_WINDOW_DAYS * 86400000) {
    return { types: [], reason: `배송 완료 후 ${RETURN_WINDOW_DAYS}일이 지나 요청할 수 없습니다. 고객센터로 문의해 주세요.` };
  }
  return { types: ["RETURN", "EXCHANGE"], reason: null };
}
