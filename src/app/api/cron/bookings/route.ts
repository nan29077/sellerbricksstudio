export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { runBookingMaintenance } from "@/lib/booking-automation";

// GET|POST /api/cron/bookings — 예약 자동 처리(만료 · 이용 완료 · 이용 전 알림)
// 외부 스케줄러: Authorization: Bearer $CRON_SECRET / 최고관리자: 로그인 상태로 호출
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const viaSecret = !!secret && auth === `Bearer ${secret}`;
  if (!viaSecret) {
    const user = await getSessionUser().catch(() => null);
    if (user?.role !== "SUPER_ADMIN") return fail("권한이 없습니다.", 401);
  }
  return ok(await runBookingMaintenance({}, { force: true }));
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
