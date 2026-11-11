import { prisma } from "./prisma";
import { notify } from "./notify";
import { notifyWaitlist } from "./booking";
import { getPolicy } from "./policy";
import { formatDateTime } from "./utils";

// 예약 자동 처리 (별도 스케줄러 없이도 동작하도록 화면을 열 때 가볍게 실행 + /api/cron/bookings 로도 실행 가능)
//  1) 승인 대기 자동 만료  2) 종료된 승인 예약 이용 완료  3) 이용 전 알림
const lastRun = new Map<string, number>();

export async function runBookingMaintenance(scope: { facilityIds?: string[]; sellerId?: string } = {}, opts: { force?: boolean } = {}) {
  const key = scope.sellerId ? `s:${scope.sellerId}` : scope.facilityIds ? `f:${scope.facilityIds.join(",")}` : "all";
  const now = Date.now();
  if (!opts.force && now - (lastRun.get(key) ?? 0) < 60_000) return { skipped: true, expired: 0, completed: 0, reminded: 0 };
  lastRun.set(key, now);
  try {
    const policy = await getPolicy();
    const where = { ...(scope.facilityIds && { facilityId: { in: scope.facilityIds } }), ...(scope.sellerId && { sellerId: scope.sellerId }) };
    const nowDate = new Date(now);
    let expired = 0, completed = 0, reminded = 0;

    // 1) 승인 대기 만료: 시작 시간이 지났거나, 신청 후 n시간 동안 응답이 없으면
    const stale = await prisma.booking.findMany({
      where: {
        ...where, status: "PENDING",
        OR: [
          { startAt: { lt: nowDate } },
          ...(policy.pendingExpireHours > 0 ? [{ createdAt: { lt: new Date(now - policy.pendingExpireHours * 3600000) } }] : []),
        ],
      },
      select: { id: true, sellerId: true, facilityId: true, startAt: true, endAt: true, code: true, facility: { select: { name: true, ownerId: true } } },
      take: 200,
    });
    for (const b of stale) {
      const r = await prisma.booking.updateMany({
        where: { id: b.id, status: "PENDING" },
        data: { status: "REJECTED", rejectReason: b.startAt < nowDate ? "이용 시간이 지나 자동 만료되었습니다." : `창고(스튜디오)가 ${policy.pendingExpireHours}시간 안에 응답하지 않아 자동 만료되었습니다.` },
      });
      if (!r.count) continue;
      expired += 1;
      await prisma.liveSession.updateMany({ where: { bookingId: b.id, status: { in: ["DRAFT", "READY"] } }, data: { status: "CANCELLED" } }).catch(() => undefined);
      await notify({ userId: b.sellerId, type: "BOOKING", title: "예약 요청이 자동 만료되었습니다", body: `${b.facility.name} · ${formatDateTime(b.startAt)} · 다른 시간이나 창고(스튜디오)로 다시 신청해 주세요.`, link: "/seller/bookings/new" });
      await notify({ userId: b.facility.ownerId, type: "BOOKING", title: "응답하지 않은 예약 요청이 만료되었습니다", body: `${formatDateTime(b.startAt)}${b.code ? ` · ${b.code}` : ""}`, link: "/facility/bookings?status=REJECTED" });
      if (b.startAt > nowDate) await notifyWaitlist(b.facilityId, b.startAt, b.endAt);
    }

    // 2) 이용 완료 자동 처리 (종료 후 1시간 지난 승인 예약)
    if (policy.autoCompleteBookings) {
      const r = await prisma.booking.updateMany({
        where: { ...where, status: "APPROVED", endAt: { lt: new Date(now - 3600000) } },
        data: { status: "COMPLETED", completedAt: nowDate },
      });
      completed = r.count;
    }

    // 3) 이용 전 알림
    if (policy.reminderHoursBefore > 0) {
      const soon = await prisma.booking.findMany({
        where: { ...where, status: "APPROVED", reminderSentAt: null, startAt: { gt: nowDate, lte: new Date(now + policy.reminderHoursBefore * 3600000) } },
        select: { id: true, sellerId: true, startAt: true, code: true, facility: { select: { name: true, ownerId: true, address: true } } },
        take: 200,
      });
      for (const b of soon) {
        const r = await prisma.booking.updateMany({ where: { id: b.id, reminderSentAt: null }, data: { reminderSentAt: nowDate } });
        if (!r.count) continue;
        reminded += 1;
        await notify({ userId: b.sellerId, type: "BOOKING", title: "곧 창고(스튜디오) 이용 시간입니다", body: `${b.facility.name} · ${formatDateTime(b.startAt)}${b.code ? ` · 예약번호 ${b.code}` : ""} · ${b.facility.address}`, link: "/seller/bookings" });
        await notify({ userId: b.facility.ownerId, type: "BOOKING", title: "곧 방문 예정인 예약이 있습니다", body: `${formatDateTime(b.startAt)}${b.code ? ` · ${b.code}` : ""}`, link: "/facility/bookings?status=APPROVED" });
      }
    }
    return { skipped: false, expired, completed, reminded };
  } catch (e) {
    console.error("booking maintenance failed", e);
    return { skipped: false, expired: 0, completed: 0, reminded: 0 };
  }
}

// 셀러 신뢰 지표 (창고(스튜디오)가 예약을 승인할 때 참고)
export async function sellerReliability(sellerIds: string[]) {
  if (!sellerIds.length) return new Map<string, { completed: number; noShow: number; cancelled: number }>();
  const rows = await prisma.booking.groupBy({ by: ["sellerId", "status"], where: { sellerId: { in: sellerIds }, status: { in: ["COMPLETED", "NO_SHOW", "CANCELLED"] } }, _count: true });
  const map = new Map<string, { completed: number; noShow: number; cancelled: number }>();
  for (const r of rows) {
    const v = map.get(r.sellerId) ?? { completed: 0, noShow: 0, cancelled: 0 };
    if (r.status === "COMPLETED") v.completed += r._count; else if (r.status === "NO_SHOW") v.noShow += r._count; else v.cancelled += r._count;
    map.set(r.sellerId, v);
  }
  return map;
}
