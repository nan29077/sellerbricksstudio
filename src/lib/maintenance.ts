// 정기 자동 처리 한 번 실행 (예약 만료 · 이용 완료 · 이용 전 알림, 결제 대기 주문 정리, 방송 자동 종료, 응대 기한, 개인정보 파기)
// 호출하는 곳: /api/cron/bookings (외부 스케줄러 · Vercel Cron) 와 서버 내장 스케줄러(INTERNAL_CRON=1, src/instrumentation.ts)
import { runBookingMaintenance } from "./booking-automation";
import { cleanupStalePendingOrders } from "./order-actions";
import { runBrandRequestMaintenance } from "./brand-request-automation";
import { endOverdueLiveSessions } from "./live-automation";
import { purgeExpiredPersonalData } from "./privacy-purge";
import { prisma } from "./prisma";
import { syncSellerbricksFeed } from "./external-broadcasts";
import { remindLateDisplayItems } from "./booking-brand-items";

export async function runAllMaintenance(opts: { forcePrivacy?: boolean } = {}) {
  const live = await endOverdueLiveSessions({ force: true }); // 예정 시간이 지난 방송 자동 종료 (예약 자동 처리보다 먼저)
  const bookings = await runBookingMaintenance({}, { force: true });
  const staleOrders = await cleanupStalePendingOrders({ force: true }).catch(() => 0);
  const brandRequests = await runBrandRequestMaintenance({ force: true });
  const privacy = await purgeExpiredPersonalData({ force: opts.forcePrivacy }); // 6시간에 한 번만 실제로 돈다
  // 외부 방송: 셀러브릭스 피드 동기화(설정된 경우) + 종료 시각이 지난 방송은 상태도 '종료'로 정리
  const sellerbricks = await syncSellerbricksFeed({ ifStale: true }).then((r) => (r.skipped ? null : r.saved)).catch(() => null);
  const broadcastsEnded = await prisma.externalBroadcast.updateMany({ where: { status: { in: ["LIVE", "SCHEDULED"] }, endsAt: { lte: new Date() } }, data: { status: "ENDED" } }).then((r) => r.count).catch(() => 0);
  const displayLate = await remindLateDisplayItems().catch(() => 0); // 내일 방송인데 시연품 미도착
  return { ...bookings, displayLate, staleOrders, brandRequests, liveEnded: live.ended, privacy, sellerbricks, broadcastsEnded };
}
