// 주문 알림
//  - 판매 쪽: 새 주문이 들어오면 셀러와 (창고 방송이면) 공간 관리자에게 앱 알림 + 메일을 보낸다.
//    브랜드는 발주서 알림(notifyNewPurchaseOrders)을 따로 받는다.
//  - 구매자 알림톡은 없앴다 (2026-11-14 · 구매자는 스토리지마켓에서 사지 않는다). 운송장은 셀러가 받아 판매한 플랫폼에 입력한다.
// 알림이 실패해도 주문 처리는 그대로 진행한다.
import { prisma } from "./prisma";
import { notify } from "./notify";
import { formatKRW } from "./utils";
import { orderParts, FULFILLMENT_ITEM_SELECT } from "./order-fulfillment";
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
    const sellerNote = parts.localShipper === "SELLER" ? " · 셀러 출고 상품이 있습니다" : parts.localShipper === "FACILITY" ? " · 공간이 출고합니다" : parts.hasBrand ? " · 브랜드가 직배송합니다" : "";
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
