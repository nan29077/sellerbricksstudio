// 주문 알림
//  - 판매 쪽: 새 주문이 들어오면 셀러와 (창고 방송이면) 창고(스튜디오) 관리자에게 앱 알림 + 메일을 보낸다.
//    브랜드는 발주서 알림(notifyNewPurchaseOrders)을 따로 받는다.
//  - 구매자: 결제 완료 · 출고(운송장) · 취소 · 환불 · 요청 답변을 카카오 알림톡으로 보낸다.
//    (알림톡 키가 없으면 테스트 모드로 발송 기록만 남는다)
// 알림이 실패해도 주문 처리는 그대로 진행한다.
import { prisma } from "./prisma";
import { notify } from "./notify";
import { getKakaoAdapter } from "./adapters/kakao";
import { appUrl } from "./mailer";
import { formatKRW } from "./utils";
import { orderParts, FULFILLMENT_ITEM_SELECT } from "./order-fulfillment";
import { SITE_NAME } from "./site-brand";
import { notifyFacility } from "./facility-owner";

export async function notifyNewOrder(orderId: string) {
  try {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, orderNo: true, status: true, totalAmount: true, sellerId: true, facilityId: true, localShippedAt: true, localDeliveredAt: true,
        facility: { select: { name: true } }, liveSession: { select: { title: true } },
        items: { select: { ...FULFILLMENT_ITEM_SELECT, quantity: true } },
        purchaseOrders: { select: { status: true, fulfillment: true } },
      },
    });
    if (!o) return;
    const parts = orderParts(o);
    const qty = o.items.reduce((s, i) => s + i.quantity, 0);
    const base = `${o.liveSession.title} · ${formatKRW(o.totalAmount)} · 상품 ${qty}개`;
    const sellerNote = parts.localShipper === "SELLER" ? " · 셀러 출고 상품이 있습니다" : parts.localShipper === "FACILITY" ? " · 창고(스튜디오)가 출고합니다" : parts.hasBrand ? " · 브랜드가 직배송합니다" : "";
    await notify({
      userId: o.sellerId, type: "ORDER", email: true,
      title: `새 주문이 들어왔습니다 · ${o.orderNo}`, body: base + sellerNote, link: "/seller/orders",
    });
    if (o.facilityId) {
      await notifyFacility(o.facilityId, {
        exclude: [o.sellerId], partnerEmail: parts.localShipper === "FACILITY",
        type: "ORDER", email: parts.localShipper === "FACILITY",
        title: parts.localShipper === "FACILITY" ? `출고할 새 주문 · ${o.orderNo}` : `새 주문 · ${o.orderNo}`,
        body: base + (parts.localShipper === "FACILITY" ? " · 상품을 준비해 출고해 주세요" : " · 브랜드가 직배송합니다"),
        link: "/facility/orders?status=todo",
      });
    }
  } catch { /* 알림 실패는 무시 */ }
}

export type BuyerEvent =
  | { kind: "PAID" }
  | { kind: "SHIPPED"; carrier?: string | null; trackingNumber?: string | null; from?: string }
  | { kind: "CANCELLED" | "REFUNDED"; amount?: number; reason?: string; partial?: boolean }
  | { kind: "CLAIM_RECEIVED"; label: string }
  | { kind: "CLAIM_ANSWERED"; label: string; accepted: boolean; answer?: string | null };

const TEMPLATE: Record<BuyerEvent["kind"], string> = {
  PAID: "ORDER_PAID", SHIPPED: "ORDER_SHIPPED", CANCELLED: "ORDER_CANCELLED", REFUNDED: "ORDER_REFUNDED",
  CLAIM_RECEIVED: "ORDER_CLAIM_RECEIVED", CLAIM_ANSWERED: "ORDER_CLAIM_ANSWERED",
};

export function buyerMessage(o: { orderNo: string; buyerName: string; totalAmount: number; id: string }, e: BuyerEvent) {
  const head = `[${SITE_NAME}] ${o.buyerName}님`;
  const link = `주문 확인: ${appUrl(`/order-complete/${o.id}`)}`;
  switch (e.kind) {
    case "PAID": return `${head}, 주문이 완료되었습니다.\n주문번호 ${o.orderNo}\n결제금액 ${formatKRW(o.totalAmount)}\n${link}`;
    case "SHIPPED": return `${head}, 주문하신 상품이 출고되었습니다.${e.from ? ` (${e.from})` : ""}\n주문번호 ${o.orderNo}${e.trackingNumber ? `\n운송장 ${e.carrier ?? ""} ${e.trackingNumber}` : ""}\n${link}`;
    case "CANCELLED":
    case "REFUNDED": {
      const what = e.kind === "CANCELLED" ? "취소" : "환불";
      return `${head}, 주문이 ${e.partial ? "일부 " : ""}${what}되었습니다.\n주문번호 ${o.orderNo}${e.amount ? `\n${what} 금액 ${formatKRW(e.amount)}` : ""}${e.reason ? `\n사유: ${e.reason}` : ""}\n카드 결제는 카드사 사정에 따라 3~7영업일 안에 취소됩니다.\n${link}`;
    }
    case "CLAIM_RECEIVED": return `${head}, ${e.label} 요청이 접수되었습니다.\n주문번호 ${o.orderNo}\n판매자가 확인 후 답변 드립니다.\n${link}`;
    case "CLAIM_ANSWERED": return `${head}, ${e.label} 요청에 판매자가 답변했습니다. (${e.accepted ? "처리 완료" : "처리 불가"})\n주문번호 ${o.orderNo}${e.answer ? `\n답변: ${e.answer}` : ""}\n${link}`;
  }
}

export async function notifyBuyer(orderId: string, e: BuyerEvent) {
  try {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNo: true, buyerName: true, buyerPhone: true, totalAmount: true },
    });
    if (!o) return;
    const phone = o.buyerPhone.replace(/[^0-9]/g, "");
    if (phone.length < 9) return; // 가려진 연락처 등
    // 방송(liveSessionId)에 묶지 않는다: 셀러의 '알림톡 발송 로그'(마케팅 발송)에 구매자 연락처가 보이지 않게
    await getKakaoAdapter().sendAlimtalk({
      templateCode: TEMPLATE[e.kind],
      recipients: [{ name: o.buyerName, phone: o.buyerPhone }], content: buyerMessage(o, e),
    });
  } catch { /* 알림 실패는 무시 */ }
}
