import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/http";
import { addDays, hhmm, kstParts, parseDateKey } from "@/lib/kst";

// GET /api/facilities/[id]/availability?date=YYYY-MM-DD
// 해당 날짜(KST)의 운영시간, 요일 슬롯, 휴무 여부, 이미 잡힌 예약 시간대를 돌려준다. (개인정보 없음)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const day = parseDateKey(req.nextUrl.searchParams.get("date"));
    if (!day) return fail("날짜 형식이 올바르지 않습니다.");
    const f = await prisma.facility.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, openTime: true, closeTime: true, minHours: true, basePrice: true, capacity: true,
        slots: { where: { isActive: true }, select: { weekday: true, startTime: true, endTime: true } } },
    });
    if (!f || f.status !== "APPROVED") return fail("창고(스튜디오)를 찾을 수 없습니다.", 404);
    const next = addDays(day, 1);
    const [blackout, bookings] = await Promise.all([
      prisma.facilityBlackoutDate.findFirst({ where: { facilityId: f.id, date: { gte: day, lt: next } } }),
      prisma.booking.findMany({
        where: { facilityId: f.id, status: { in: ["PENDING", "APPROVED"] }, startAt: { lt: next }, endAt: { gt: day } },
        select: { startAt: true, endAt: true, status: true }, orderBy: { startAt: "asc" },
      }),
    ]);
    const weekday = kstParts(day).weekday;
    const slots = f.slots.filter((s) => s.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return ok({
      openTime: f.openTime ?? "09:00", closeTime: f.closeTime ?? "22:00", minHours: f.minHours, basePrice: f.basePrice, capacity: f.capacity,
      hasSlots: f.slots.length > 0, slots, closed: !!blackout || (f.slots.length > 0 && slots.length === 0),
      closedReason: blackout ? (blackout.reason ?? "휴무일") : (f.slots.length > 0 && slots.length === 0 ? "운영하지 않는 요일" : null),
      booked: bookings.map((b) => ({ start: b.startAt < day ? "00:00" : hhmm(b.startAt), end: b.endAt >= next ? "24:00" : hhmm(b.endAt), status: b.status })),
    });
  } catch (e) { return handleError(e); }
}
