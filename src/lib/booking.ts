import { prisma } from "./prisma";
import { dateKey, hhmm, hoursBetween, kstParts, kstStartOfDay, WEEKDAYS } from "./kst";

// 예약 이용료 = 시간당 요금 × 이용 시간 (30분 단위 반올림 없이 비례 계산)
export function calcBookingPrice(basePrice: number, startAt: Date, endAt: Date): number {
  return Math.round(basePrice * hoursBetween(startAt, endAt));
}

// 예약 가능 여부 검사 (운영시간 · 휴무일 · 요일별 운영 슬롯 · 최소 시간 · 중복)
export async function checkBookingAvailability(params: {
  facilityId: string; startAt: Date; endAt: Date; excludeBookingId?: string;
}): Promise<string | null> {
  const { facilityId, startAt, endAt } = params;
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { slots: { where: { isActive: true } } },
  });
  if (!facility) return "창고(스튜디오)를 찾을 수 없습니다.";
  if (endAt <= startAt) return "종료 시간은 시작 시간보다 뒤여야 합니다.";
  if (startAt.getTime() < Date.now() - 5 * 60 * 1000) return "지난 시간은 예약할 수 없습니다.";

  const hours = hoursBetween(startAt, endAt);
  if (hours < (facility.minHours ?? 1)) return `최소 ${facility.minHours}시간 이상 예약해야 합니다.`;
  if (hours > 24) return "한 번에 24시간을 넘겨 예약할 수 없습니다.";

  const s = kstParts(startAt), e = kstParts(new Date(endAt.getTime() - 1));
  const sameDay = s.year === e.year && s.month === e.month && s.day === e.day;
  const startHm = hhmm(startAt);
  const endHm = hhmm(endAt) === "00:00" ? "24:00" : hhmm(endAt);

  if (sameDay && facility.openTime && facility.closeTime) {
    if (startHm < facility.openTime || endHm > facility.closeTime) {
      return `운영 시간(${facility.openTime}~${facility.closeTime}) 안에서 예약하세요.`;
    }
  }

  // 요일별 운영 슬롯이 등록돼 있으면 해당 요일 슬롯 안에 들어와야 한다.
  if (sameDay && facility.slots.length > 0) {
    const daySlots = facility.slots.filter((sl) => sl.weekday === s.weekday);
    if (daySlots.length === 0) return `${WEEKDAYS[s.weekday]}요일은 운영하지 않습니다.`;
    const inside = daySlots.some((sl) => startHm >= sl.startTime && endHm <= sl.endTime);
    if (!inside) {
      const list = daySlots.map((sl) => `${sl.startTime}~${sl.endTime}`).join(", ");
      return `${WEEKDAYS[s.weekday]}요일 예약 가능 시간은 ${list} 입니다.`;
    }
  }

  const day = kstStartOfDay(startAt);
  const blackout = await prisma.facilityBlackoutDate.findFirst({
    where: { facilityId, date: { gte: day, lt: new Date(endAt.getTime()) } },
  });
  if (blackout) return `${dateKey(blackout.date)}은(는) 휴무일입니다.${blackout.reason ? ` (${blackout.reason})` : ""}`;

  const overlap = await prisma.booking.findFirst({
    where: {
      facilityId, status: { in: ["PENDING", "APPROVED"] },
      startAt: { lt: endAt }, endAt: { gt: startAt },
      ...(params.excludeBookingId && { id: { not: params.excludeBookingId } }),
    },
  });
  if (overlap) return "해당 시간대에 이미 예약이 있습니다. 다른 시간을 선택하세요.";
  return null;
}

// 플랫폼 수수료율(%) — CommissionRule(scope=PLATFORM) 최신값, 창고(스튜디오)별 값이 있으면 우선
export async function getPlatformFeeRate(facilityId?: string): Promise<number> {
  try {
    if (facilityId) {
      const f = await prisma.commissionRule.findFirst({
        where: { scope: "FACILITY", facilityId, commissionType: "PERCENT" }, orderBy: { createdAt: "desc" },
      });
      if (f) return f.commissionValue;
    }
    const p = await prisma.commissionRule.findFirst({
      where: { scope: "PLATFORM", commissionType: "PERCENT" }, orderBy: { createdAt: "desc" },
    });
    return p?.commissionValue ?? 10;
  } catch { return 10; }
}

export function splitFee(gross: number, rate: number) {
  const platformFee = Math.round((gross * rate) / 100);
  return { platformFee, payoutAmount: gross - platformFee };
}

// 리뷰 작성/숨김 후 창고(스튜디오) 평점 재계산
export async function refreshFacilityRating(facilityId: string) {
  const agg = await prisma.facilityReview.aggregate({
    where: { facilityId, isHidden: false }, _avg: { rating: true },
  });
  await prisma.facility.update({
    where: { id: facilityId }, data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10 },
  });
}

export const BOOKING_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["COMPLETED", "CANCELLED"],
};
