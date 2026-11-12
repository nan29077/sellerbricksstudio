export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { runBookingMaintenance } from "@/lib/booking-automation";
import { cleanupStalePendingOrders } from "@/lib/order-actions";
import { runBrandRequestMaintenance } from "@/lib/brand-request-automation";
import { endOverdueLiveSessions } from "@/lib/live-automation";

// GET|POST /api/cron/bookings — 예약 자동 처리(만료 · 이용 완료 · 이용 전 알림) + 결제 대기 주문 정리 + 방송 자동 종료
// 외부 스케줄러: Authorization: Bearer $CRON_SECRET / 최고관리자: 로그인 상태로 호출
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const viaSecret = !!secret && auth === `Bearer ${secret}`;
  if (!viaSecret) {
    const user = await getSessionUser().catch(() => null);
    if (user?.role !== "SUPER_ADMIN") return fail("권한이 없습니다.", 401);
  }
  const live = await endOverdueLiveSessions({ force: true }); // 예정 시간이 지난 방송 자동 종료 (예약 자동 처리보다 먼저)
  const bookings = await runBookingMaintenance({}, { force: true });
  const staleOrders = await cleanupStalePendingOrders({ force: true }).catch(() => 0); // 결제 대기에서 멈춘 주문 정리
  const brandRequests = await runBrandRequestMaintenance({ force: true }); // 샘플·입고 요청 응대 기한
  return ok({ ...bookings, staleOrders, brandRequests, liveEnded: live.ended });
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
