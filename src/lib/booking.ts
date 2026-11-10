import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { notify } from "./notify";
import { addDays, dateKey, kstParts, kstStartOfDay, parseDateKey, WEEKDAYS } from "./kst";
import { formatDateTime } from "./utils";
import {
  policyOf, openWindows, startOptions, summarizeDay, validateRequest, toHm,
  type BusyBlock, type BookingPolicy, type DaySummary, type Interval, type StartOption,
} from "./booking-engine";

type Db = Prisma.TransactionClient | typeof prisma;

// 창고(스튜디오) 이용료는 무료. (과거 호환용으로 함수만 남겨둔다)
export function calcBookingPrice(_basePrice?: number, _startAt?: Date, _endAt?: Date): number {
  return 0;
}

export const FACILITY_POLICY_SELECT = {
  id: true, name: true, ownerId: true, status: true, openTime: true, closeTime: true, minHours: true, capacity: true,
  bookingUnitMinutes: true, bufferMinutes: true, minLeadHours: true, maxAdvanceDays: true, maxHours: true,
  autoApprove: true, cancelDeadlineHours: true, bookingNotice: true, cancelPolicy: true,
  slots: { where: { isActive: true }, select: { weekday: true, startTime: true, endTime: true, isActive: true } },
} satisfies Prisma.FacilitySelect;

export type FacilityWithPolicy = Prisma.FacilityGetPayload<{ select: typeof FACILITY_POLICY_SELECT }>;

const minutesFrom = (day: Date, d: Date) => Math.round((d.getTime() - day.getTime()) / 60000);

// 같은 창고(스튜디오)의 예약 생성·변경을 한 줄로 세워 동시에 같은 시간을 잡는 것을 막는다. (트랜잭션 안에서만 호출)
export async function lockFacility(tx: Prisma.TransactionClient, facilityId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${facilityId}))`;
}

// 하루치 운영 구간 · 점유 구간 로드
export async function loadDay(facility: FacilityWithPolicy, day: Date, opts: { excludeBookingId?: string; db?: Db } = {}) {
  const db = opts.db ?? prisma;
  const next = addDays(day, 1);
  const policy = policyOf(facility);
  const [blackout, bookings] = await Promise.all([
    db.facilityBlackoutDate.findFirst({ where: { facilityId: facility.id, date: { gte: day, lt: next } } }),
    db.booking.findMany({
      where: {
        facilityId: facility.id, status: { in: ["PENDING", "APPROVED"] },
        startAt: { lt: next }, endAt: { gt: day },
        ...(opts.excludeBookingId && { id: { not: opts.excludeBookingId } }),
      },
      select: { id: true, startAt: true, endAt: true, status: true }, orderBy: { startAt: "asc" },
    }),
  ]);
  const weekday = kstParts(day).weekday;
  const windows = openWindows(policy, facility.slots, weekday, !!blackout);
  const busy: BusyBlock[] = bookings.map((b) => ({
    id: b.id, status: b.status, start: Math.max(0, minutesFrom(day, b.startAt)), end: Math.min(24 * 60, minutesFrom(day, b.endAt)),
  }));
  const closedReason = blackout ? (blackout.reason ?? "휴무일") : windows.length === 0 ? `${WEEKDAYS[weekday]}요일 휴무` : null;
  return { policy, windows, busy, weekday, closedReason };
}

export function earliestMinFor(day: Date, policy: BookingPolicy, now = new Date()) {
  return minutesFrom(day, new Date(now.getTime() + policy.minLeadHours * 3600000));
}

export function daysAheadOf(day: Date, now = new Date()) {
  return Math.round((day.getTime() - kstStartOfDay(now).getTime()) / 86400000);
}

export async function getFacilityWithPolicy(facilityId: string, db: Db = prisma) {
  return db.facility.findUnique({ where: { id: facilityId }, select: FACILITY_POLICY_SELECT });
}

// 날짜 하루의 예약 화면용 데이터 (개인정보 없음)
export async function getDaySchedule(facility: FacilityWithPolicy, date: string, durationMin?: number, excludeBookingId?: string) {
  const day = parseDateKey(date);
  if (!day) throw new Error("날짜 형식이 올바르지 않습니다.");
  const { policy, windows, busy, closedReason } = await loadDay(facility, day, { excludeBookingId });
  const dur = Math.max(policy.minHours * 60, Math.min(policy.maxHours * 60, durationMin ?? policy.minHours * 60));
  const daysAhead = daysAheadOf(day);
  const outOfRange = daysAhead < 0 || daysAhead > policy.maxAdvanceDays;
  const options: StartOption[] = outOfRange ? [] : startOptions({ policy, windows, busy, durationMin: dur, earliestMin: earliestMinFor(day, policy) });
  return {
    date, policy, durationMin: dur,
    windows: windows.map((w) => ({ start: toHm(w.start), end: w.end >= 1440 ? "24:00" : toHm(w.end) })),
    booked: busy.map((b) => ({ start: toHm(b.start), end: b.end >= 1440 ? "24:00" : toHm(b.end), status: b.status })),
    options,
    closed: windows.length === 0 || outOfRange,
    closedReason: outOfRange ? (daysAhead < 0 ? "지난 날짜" : `최대 ${policy.maxAdvanceDays}일 뒤까지 예약 가능`) : closedReason,
  };
}

// 기간 달력 (최대 62일)
export async function getRangeSummary(facility: FacilityWithPolicy, from: Date, days: number): Promise<DaySummary[]> {
  const n = Math.min(62, Math.max(1, days));
  const end = addDays(from, n);
  const policy = policyOf(facility);
  const [blackouts, bookings] = await Promise.all([
    prisma.facilityBlackoutDate.findMany({ where: { facilityId: facility.id, date: { gte: from, lt: end } } }),
    prisma.booking.findMany({
      where: { facilityId: facility.id, status: { in: ["PENDING", "APPROVED"] }, startAt: { lt: end }, endAt: { gt: from } },
      select: { startAt: true, endAt: true, status: true },
    }),
  ]);
  const off = new Map(blackouts.map((b) => [dateKey(b.date), b.reason ?? "휴무일"]));
  const out: DaySummary[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays(from, i);
    const key = dateKey(day);
    const weekday = kstParts(day).weekday;
    const windows = openWindows(policy, facility.slots, weekday, off.has(key));
    const next = addDays(day, 1);
    const busy: BusyBlock[] = bookings.filter((b) => b.startAt < next && b.endAt > day)
      .map((b) => ({ status: b.status, start: Math.max(0, minutesFrom(day, b.startAt)), end: Math.min(1440, minutesFrom(day, b.endAt)) }));
    const ahead = daysAheadOf(day);
    out.push(summarizeDay({
      date: key, weekday, policy, windows, busy, earliestMin: earliestMinFor(day, policy),
      outOfRange: ahead < 0 || ahead > policy.maxAdvanceDays, closedReason: off.get(key) ?? (windows.length ? null : `${WEEKDAYS[weekday]}요일 휴무`),
    }));
  }
  return out;
}

// 예약 가능 여부 최종 검사 (운영 시간대 · 휴무일 · 단위 · 최소/최대 시간 · 선예약 기간 · 준비시간 포함 중복)
export async function checkBookingAvailability(params: {
  facilityId: string; startAt: Date; endAt: Date; excludeBookingId?: string; db?: Db; facility?: FacilityWithPolicy | null;
}): Promise<string | null> {
  const db = params.db ?? prisma;
  const facility = params.facility ?? await getFacilityWithPolicy(params.facilityId, db);
  if (!facility) return "창고(스튜디오)를 찾을 수 없습니다.";
  const { startAt, endAt } = params;
  if (!(startAt instanceof Date) || isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return "예약 시간이 올바르지 않습니다.";
  const day = kstStartOfDay(startAt);
  const { policy, windows, busy, weekday, closedReason } = await loadDay(facility, day, { excludeBookingId: params.excludeBookingId, db });
  const startMin = minutesFrom(day, startAt);
  const endMin = minutesFrom(day, endAt);
  return validateRequest({
    policy, windows, busy, startMin, endMin, sameDay: endMin <= 24 * 60,
    minutesUntilStart: Math.round((startAt.getTime() - Date.now()) / 60000),
    daysAhead: daysAheadOf(day), weekdayLabel: WEEKDAYS[weekday], closedReason,
  });
}

// 비어난 시간대에 대기 신청한 셀러에게 알림
export async function notifyWaitlist(facilityId: string, startAt: Date, endAt: Date) {
  try {
    const rows = await prisma.bookingWaitlist.findMany({
      where: { facilityId, status: "WAITING", startAt: { lt: endAt }, endAt: { gt: startAt } },
      include: { facility: { select: { name: true } } },
    });
    if (!rows.length) return;
    await prisma.bookingWaitlist.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: "NOTIFIED", notifiedAt: new Date() } });
    for (const r of rows) {
      const date = dateKey(r.startAt);
      await notify({
        userId: r.sellerId, type: "BOOKING", title: "대기하던 시간에 자리가 났어요",
        body: `${r.facility.name} · ${formatDateTime(r.startAt)} — 먼저 예약하는 셀러에게 확정됩니다.`,
        link: `/seller/bookings/new?facilityId=${facilityId}&date=${date}&start=${toHm(kstParts(r.startAt).hour * 60 + kstParts(r.startAt).minute)}`,
      });
    }
  } catch { /* 알림 실패는 무시 */ }
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

export type { Interval };
