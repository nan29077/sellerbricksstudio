export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { runBookingMaintenance } from "@/lib/booking-automation";
import { cleanupStalePendingOrders } from "@/lib/order-actions";

// GET|POST /api/cron/bookings — 예약 자동 처리(만료 · 이용 완료 · 이용 전 알림) + 결제 대기 주문 정리
// 외부 스케줄러: Authorization: Bearer $CRON_SECRET / 최고관리자: 로그인 상태로 호출
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const viaSecret = !!secret && auth === `Bearer ${secret}`;
  if (!viaSecret) {
    const user = await getSessionUser().catch(() => null);
    if (user?.role !== "SUPER_ADMIN") return fail("권한이 없습니다.", 401);
  }
  const bookings = await runBookingMaintenance({}, { force: true });
  const staleOrders = await cleanupStalePendingOrders({ force: true }).catch(() => 0); // 결제 대기에서 멈춘 주문 정리
  return ok({ ...bookings, staleOrders });
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
