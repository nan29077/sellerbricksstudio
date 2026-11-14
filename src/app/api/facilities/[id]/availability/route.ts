import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/http";
import { getDaySchedule, getFacilityWithPolicy } from "@/lib/booking";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canOperateFacility } from "@/lib/facility-owner";

// GET /api/facilities/[id]/availability?date=YYYY-MM-DD&hours=2&exclude=<bookingId>
// 해당 날짜(KST)의 운영 구간, 예약 정책, 이미 잡힌 시간대, 선택한 이용 시간 기준 "시작 가능 시각" 목록. (개인정보 없음)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const date = req.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("날짜 형식이 올바르지 않습니다.");
    const f = await getFacilityWithPolicy(params.id);
    if (!f || f.status !== "APPROVED") return fail("공간을 찾을 수 없습니다.", 404);
    const hours = Number(req.nextUrl.searchParams.get("hours"));
    // 일정 변경 시 본인 예약은 점유에서 제외 (본인 예약일 때만)
    let exclude: string | undefined;
    const ex = req.nextUrl.searchParams.get("exclude");
    if (ex) {
      const user = await getSessionUser().catch(() => null);
      const b = user ? await prisma.booking.findUnique({ where: { id: ex }, select: { sellerId: true, facilityId: true } }) : null;
      if (b && b.facilityId === f.id && (b.sellerId === user!.id || (await canOperateFacility(user, f.id)))) exclude = ex;
    }
    const day = await getDaySchedule(f, date, Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : undefined, exclude);
    const { policy } = day;
    return ok({
      ...day,
      // 이전 화면 호환 필드
      openTime: policy.openTime, closeTime: policy.closeTime, minHours: policy.minHours, capacity: policy.capacity, basePrice: 0,
      hasSlots: f.slots.length > 0, slots: day.windows.map((w) => ({ startTime: w.start, endTime: w.end })),
      notice: f.bookingNotice, cancelPolicy: f.cancelPolicy,
    });
  } catch (e) { return handleError(e); }
}
