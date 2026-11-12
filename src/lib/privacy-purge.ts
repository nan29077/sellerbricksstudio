// 개인정보 파기 (정기 실행: /api/cron/bookings 에서 하루 한 번 꼴로 돈다)
//  - 구매자 이름 · 연락처 · 배송지: 거래가 끝나고(배송 완료 · 취소 · 환불) 5년이 지나면 지운다.
//    (전자상거래법상 계약 · 대금결제 · 청약철회 기록 보관 기간 5년. 결제 화면 동의 문구와 같다)
//    보관 기간 안에서는 화면에서만 가린다(주문 운영 정책의 '구매자 정보 표시 기간').
//  - 브랜드 발주서의 받는 분 정보도 같은 기준으로 지운다.
//  - 알림톡 발송 기록(받는 번호 · 내용)은 1년, 끝난 인증 토큰 · 요청 제한 기록은 바로 지운다.
import { prisma } from "./prisma";

export const BUYER_PII_YEARS = 5;
export const SEND_LOG_DAYS = 365;
const ERASED = "(파기됨)";
let lastRun = 0;

export async function purgeExpiredPersonalData(opts: { force?: boolean; now?: Date } = {}) {
  const nowMs = (opts.now ?? new Date()).getTime();
  if (!opts.force && nowMs - lastRun < 6 * 3600000) return { skipped: true, orders: 0, purchaseOrders: 0, logs: 0, tokens: 0 };
  lastRun = nowMs;
  const cutoff = new Date(nowMs - BUYER_PII_YEARS * 365 * 86400000);
  const now = new Date(nowMs);
  let orders = 0, purchaseOrders = 0, logs = 0, tokens = 0;
  try {
    const closed = await prisma.order.findMany({
      where: {
        buyerName: { not: ERASED },
        OR: [
          { status: "DELIVERED", deliveredAt: { lt: cutoff } },
          { status: { in: ["CANCELLED", "REFUNDED"] }, updatedAt: { lt: cutoff } },
          { status: "DELIVERED", deliveredAt: null, updatedAt: { lt: cutoff } },
        ],
      },
      select: { id: true }, take: 500,
    });
    const ids = closed.map((o) => o.id);
    if (ids.length) {
      const r = await prisma.order.updateMany({ where: { id: { in: ids } }, data: { buyerName: ERASED, buyerPhone: "", buyerAddress: null } });
      orders = r.count;
      const p = await prisma.purchaseOrder.updateMany({ where: { orderId: { in: ids }, fulfillment: "DROPSHIP" }, data: { recipient: ERASED, phone: "", address: "" } });
      purchaseOrders = p.count;
    }
    logs = (await prisma.notificationLog.deleteMany({ where: { createdAt: { lt: new Date(nowMs - SEND_LOG_DAYS * 86400000) } } })).count;
    tokens = (await prisma.authToken.deleteMany({ where: { expiresAt: { lt: now } } })).count;
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => null);
  } catch (e) {
    console.error("[privacy-purge]", e);
  }
  return { skipped: false, orders, purchaseOrders, logs, tokens };
}
