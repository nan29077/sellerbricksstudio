export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { runAllMaintenance } from "@/lib/maintenance";

// GET|POST /api/cron/bookings — 정기 자동 처리 (예약 · 결제 대기 주문 · 방송 자동 종료 · 응대 기한 · 개인정보 파기)
// 외부 스케줄러(Vercel Cron 포함): Authorization: Bearer $CRON_SECRET / 최고관리자: 로그인 상태로 호출
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const viaSecret = !!secret && auth === `Bearer ${secret}`;
  let isAdmin = false;
  if (!viaSecret) {
    const user = await getSessionUser().catch(() => null);
    if (user?.role !== "SUPER_ADMIN") return fail("권한이 없습니다.", 401);
    isAdmin = true;
  }
  // 최고관리자는 ?privacy=force 로 개인정보 파기를 바로 돌릴 수 있다 (점검용)
  return ok(await runAllMaintenance({ forcePrivacy: isAdmin && req.nextUrl.searchParams.get("privacy") === "force" }));
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
