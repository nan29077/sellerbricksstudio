import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { audit } from "./audit";
import { notify } from "./notify";
import {
  BOOKING_TRANSITIONS, checkBookingAvailability, getFacilityWithPolicy, lockFacility, notifyWaitlist,
} from "./booking";
import { bookingCode, policyOf, sellerCanModify } from "./booking-engine";
import { addDays, dateKey, hhmm } from "./kst";
import { formatDateTime } from "./utils";
import { getPolicy } from "./policy";
import type { SessionUser } from "./auth";

const LABEL: Record<string, string> = { APPROVED: "승인", REJECTED: "거절", CANCELLED: "취소", COMPLETED: "이용 완료", NO_SHOW: "노쇼 처리" };

// ---------------------------------------------------------------------------
// 예약 생성 (상품 선택 · 매주 반복 · 즉시 확정 · 동시성 잠금)
// ---------------------------------------------------------------------------
export type CreateBookingInput = {
  facilityId: string; startAt: Date; endAt: Date;
  purpose?: string; headcount?: number | null; requestNote?: string | null;
  products?: { facilityProductId: string; quantity: number }[];
  repeatWeeks?: number;            // 1 = 반복 없음, 최대 12
  skipConflicts?: boolean;         // 반복 중 안 되는 날짜는 건너뛰고 나머지만 예약
  dryRun?: boolean;                // 검사만
};

export type OccurrenceResult = { date: string; start: string; end: string; ok: boolean; reason?: string | null };

export async function createBookings(user: SessionUser, input: CreateBookingInput) {
  const facility = await getFacilityWithPolicy(input.facilityId);
  if (!facility || facility.status !== "APPROVED") throw new Error("예약할 수 없는 창고(스튜디오)입니다.");
  const policy = policyOf(facility);
  if (policy.capacity && input.headcount && input.headcount > policy.capacity) throw new Error(`최대 수용 인원은 ${policy.capacity}명입니다.`);

  // 상품 검증 + 스냅샷
  const wanted = new Map<string, number>();
  for (const p of input.products ?? []) {
    const q = Math.max(1, Math.min(100000, Math.round(Number(p.quantity) || 1)));
    if (p.facilityProductId) wanted.set(p.facilityProductId, (wanted.get(p.facilityProductId) ?? 0) + q);
  }
  if (wanted.size > 50) throw new Error("상품은 한 예약에 50개까지 선택할 수 있습니다.");
  const fps = wanted.size ? await prisma.facilityProduct.findMany({
    where: { id: { in: [...wanted.keys()] } }, include: { product: { select: { name: true } } },
  }) : [];
  for (const id of wanted.keys()) {
    const fp = fps.find((x) => x.id === id);
    if (!fp || fp.facilityId !== facility.id) throw new Error("이 창고(스튜디오)의 상품만 선택할 수 있습니다.");
    if (!fp.isSellable) throw new Error(`판매 중단된 상품입니다: ${fp.product.name}`);
    if (wanted.get(id)! > fp.stock) throw new Error(`재고보다 많이 선택했습니다: ${fp.product.name} (재고 ${fp.stock}개)`);
  }
  const productRows = fps.map((fp) => ({
    facilityProductId: fp.id, quantity: wanted.get(fp.id)!, nameSnapshot: fp.product.name, priceSnapshot: fp.salePrice,
    commissionType: fp.commissionType, commissionValue: fp.commissionValue,
  }));

  // 반복 일정 펼치기
  const weeks = Math.max(1, Math.min(12, Math.round(input.repeatWeeks ?? 1)));
  const occurrences = Array.from({ length: weeks }, (_, i) => ({ startAt: addDays(input.startAt, i * 7), endAt: addDays(input.endAt, i * 7) }));

  const check = async (db?: Parameters<typeof checkBookingAvailability>[0]["db"]) => {
    const results: OccurrenceResult[] = [];
    for (const o of occurrences) {
      const reason = await checkBookingAvailability({ facilityId: facility.id, startAt: o.startAt, endAt: o.endAt, facility, db });
      results.push({ date: dateKey(o.startAt), start: hhmm(o.startAt), end: hhmm(o.endAt), ok: !reason, reason });
    }
    return results;
  };

  if (input.dryRun) return { created: [], results: await check(), autoApproved: policy.autoApprove };

  const status = policy.autoApprove ? "APPROVED" : "PENDING";
  // 승인 대기 예약으로 시간대를 무한정 잡아 두지 못하게 셀러별 동시 대기 건수를 제한한다.
  if (status === "PENDING") {
    const { maxPendingBookings } = await getPolicy();
    if (maxPendingBookings > 0) {
      const waiting = await prisma.booking.count({ where: { sellerId: user.id, status: "PENDING", startAt: { gt: new Date() } } });
      if (waiting + occurrences.length > maxPendingBookings) {
        throw new Error(`승인 대기 중인 예약은 최대 ${maxPendingBookings}건까지 둘 수 있습니다. (현재 ${waiting}건) 승인되거나 취소된 뒤 다시 신청해 주세요.`);
      }
    }
  }
  const groupId = weeks > 1 ? randomUUID() : null;
  const now = new Date();

  const { created, results } = await prisma.$transaction(async (tx) => {
    await lockFacility(tx, facility.id);
    const results = await check(tx);
    const okOnes = occurrences.filter((_, i) => results[i].ok);
    if (okOnes.length === 0) throw new Error(results[0]?.reason ?? "예약할 수 없는 시간입니다.");
    if (okOnes.length < occurrences.length && !input.skipConflicts) {
      const bad = results.filter((r) => !r.ok).map((r) => `${r.date}: ${r.reason}`).join("\n");
      throw new Error(`예약할 수 없는 날짜가 있습니다.\n${bad}`);
    }
    const created = [];
    for (const o of okOnes) {
      let row = null;
      for (let attempt = 0; attempt < 3 && !row; attempt++) {
        try {
          row = await tx.booking.create({
            data: {
              facilityId: facility.id, sellerId: user.id, startAt: o.startAt, endAt: o.endAt, status,
              approvedAt: status === "APPROVED" ? now : null,
              code: bookingCode(dateKey(o.startAt).replace(/-/g, "")), groupId,
              purpose: input.purpose?.trim() || null, headcount: input.headcount ?? null,
              requestNote: input.requestNote?.trim() || null, totalPrice: 0,
              expectedProducts: productRows.map((p) => `${p.nameSnapshot} ×${p.quantity}`).join(", ").slice(0, 500) || null,
              products: productRows.length ? { create: productRows } : undefined,
            },
          });
        } catch (e: any) { if (e?.code !== "P2002") throw e; }
      }
      if (!row) throw new Error("예약번호 생성에 실패했습니다. 다시 시도하세요.");
      created.push(row);
    }
    return { created, results };
  }, { timeout: 20000 });

  await audit({ actorId: user.id, action: "BOOKING_CREATE", entity: "Booking", entityId: created[0].id, meta: { count: created.length, groupId, autoApproved: policy.autoApprove, products: productRows.length } });
  const first = created[0];
  const when = `${formatDateTime(first.startAt)}${created.length > 1 ? ` 외 ${created.length - 1}회 (매주)` : ""}`;
  await notify({
    userId: facility.ownerId, type: "BOOKING",
    title: policy.autoApprove ? "새 예약이 확정되었습니다" : "새 예약 요청이 들어왔습니다",
    body: `${facility.name} · ${when}${productRows.length ? ` · 상품 ${productRows.length}종` : ""}${input.purpose ? ` · ${input.purpose}` : ""}`,
    link: policy.autoApprove ? `/facility/bookings?status=APPROVED` : `/facility/bookings?status=PENDING`,
  });
  if (policy.autoApprove) {
    await notify({ userId: user.id, type: "BOOKING", title: "예약이 바로 확정되었습니다", body: `${facility.name} · ${when} · 예약번호 ${first.code}`, link: "/seller/bookings" });
  }
  // 대기 신청해 둔 같은 시간대는 예약 완료로 정리
  await prisma.bookingWaitlist.updateMany({
    where: { sellerId: user.id, facilityId: facility.id, status: { in: ["WAITING", "NOTIFIED"] }, startAt: { lt: first.endAt }, endAt: { gt: first.startAt } },
    data: { status: "BOOKED" },
  }).catch(() => undefined);
  return { created, results, autoApproved: policy.autoApprove };
}

// ---------------------------------------------------------------------------
// 상태 변경 (단건/일괄 공용). 실패 시 사유 문자열을 던진다.
// ---------------------------------------------------------------------------
export async function changeBookingStatus(user: SessionUser, bookingId: string, status: string, reason?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId }, include: { facility: { select: { id: true, name: true, ownerId: true, cancelDeadlineHours: true } } },
  });
  if (!booking) throw new Error("예약을 찾을 수 없습니다.");

  const isOwner = booking.facility.ownerId === user.id;
  const isSeller = booking.sellerId === user.id;
  const isAdmin = user.role === "SUPER_ADMIN";

  if (status === "CANCELLED") {
    if (!isSeller && !isOwner && !isAdmin) throw new Error("취소 권한이 없습니다.");
  } else if (["APPROVED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(status)) {
    if (!isOwner && !isAdmin) throw new Error("승인/거절 권한이 없습니다.");
  } else throw new Error("허용되지 않은 상태입니다.");

  if (!(BOOKING_TRANSITIONS[booking.status] ?? []).includes(status)) {
    throw new Error("현재 예약 상태에서는 이 처리를 할 수 없습니다.");
  }
  // 셀러 직접 취소는 승인된 예약이면 취소 마감 시간 전까지만
  if (status === "CANCELLED" && isSeller && !isOwner && !isAdmin) {
    const can = sellerCanModify(booking.status, booking.startAt, booking.facility.cancelDeadlineHours ?? 24);
    if (!can.ok) throw new Error(can.reason);
  }
  const text = String(reason ?? "").trim().slice(0, 300);
  if (status === "REJECTED" && !text) throw new Error("거절 사유를 입력하세요.");
  if (status === "CANCELLED" && !isSeller && !text) throw new Error("취소 사유를 입력하세요. (셀러에게 표시됩니다)");
  if (status === "COMPLETED" && booking.startAt > new Date()) {
    throw new Error("이용 시작 전 예약은 완료 처리할 수 없습니다.");
  }
  if (status === "NO_SHOW") {
    const { noShowGraceMinutes } = await getPolicy();
    if (booking.checkedInAt) throw new Error("체크인한 예약은 노쇼로 처리할 수 없습니다.");
    if (Date.now() < booking.startAt.getTime() + noShowGraceMinutes * 60000) throw new Error(`이용 시작 ${noShowGraceMinutes}분 후부터 노쇼로 처리할 수 있습니다.`);
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    if (status === "APPROVED") {
      await lockFacility(tx, booking.facilityId);
      const clash = await tx.booking.findFirst({
        where: {
          id: { not: booking.id }, facilityId: booking.facilityId, status: "APPROVED",
          startAt: { lt: booking.endAt }, endAt: { gt: booking.startAt },
        },
      });
      if (clash) throw new Error("같은 시간대에 이미 승인된 예약이 있습니다.");
    }
    return tx.booking.update({
      where: { id: bookingId },
      data: {
        status: status as any,
        rejectReason: status === "REJECTED" ? text : booking.rejectReason,
        cancelReason: status === "CANCELLED" ? (text || "셀러 요청으로 취소") : booking.cancelReason,
        approvedAt: status === "APPROVED" ? now : booking.approvedAt,
        cancelledAt: status === "CANCELLED" ? now : booking.cancelledAt,
        completedAt: status === "COMPLETED" ? now : booking.completedAt,
        noShowAt: status === "NO_SHOW" ? now : status === "COMPLETED" ? null : booking.noShowAt,
      },
    });
  });
  // 승인 시 요청 상품은 별도 표시가 없으면 확정 처리
  if (status === "APPROVED") {
    await prisma.bookingProduct.updateMany({ where: { bookingId, status: "REQUESTED" }, data: { status: "CONFIRMED" } }).catch(() => undefined);
  }
  await audit({ actorId: user.id, action: `BOOKING_${status}`, entity: "Booking", entityId: booking.id, meta: text ? { reason: text } : undefined });

  const when = formatDateTime(booking.startAt);
  if (isSeller && !isAdmin) {
    await notify({
      userId: booking.facility.ownerId, type: "BOOKING", title: `셀러가 예약을 취소했습니다`,
      body: `${booking.facility.name} · ${when}${text ? ` · ${text}` : ""}`, link: `/facility/bookings?status=CANCELLED`,
    });
  } else {
    await notify({
      userId: booking.sellerId, type: "BOOKING", title: `예약이 ${LABEL[status]}되었습니다`,
      body: `${booking.facility.name} · ${when}${booking.code ? ` · ${booking.code}` : ""}${text ? ` · 사유: ${text}` : ""}`,
      link: status === "COMPLETED" ? `/seller/bookings?status=COMPLETED` : `/seller/bookings`,
    });
  }
  if (status === "CANCELLED" || status === "REJECTED" || status === "NO_SHOW") {
    // 아직 방송 전인 라이브 세션은 함께 취소
    await prisma.liveSession.updateMany({ where: { bookingId, status: { in: ["DRAFT", "READY"] } }, data: { status: "CANCELLED" } }).catch(() => undefined);
    await notifyWaitlist(booking.facilityId, booking.startAt, booking.endAt);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// 일정 변경: 셀러(마감 전) · 창고 관리자 · 최고관리자. 승인된 예약을 셀러가 바꾸면 다시 승인 대기로 돌아간다.
// ---------------------------------------------------------------------------
export async function rescheduleBooking(user: SessionUser, bookingId: string, startAt: Date, endAt: Date) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { facility: { select: { id: true, name: true, ownerId: true, autoApprove: true, cancelDeadlineHours: true } }, liveSession: { select: { id: true, status: true } } },
  });
  if (!booking) throw new Error("예약을 찾을 수 없습니다.");
  const isOwner = booking.facility.ownerId === user.id;
  const isSeller = booking.sellerId === user.id;
  const isAdmin = user.role === "SUPER_ADMIN";
  if (!isSeller && !isOwner && !isAdmin) throw new Error("FORBIDDEN");
  if (isSeller && !isOwner && !isAdmin) {
    const can = sellerCanModify(booking.status, booking.startAt, booking.facility.cancelDeadlineHours ?? 24);
    if (!can.ok) throw new Error(can.reason);
  } else if (!["PENDING", "APPROVED"].includes(booking.status)) throw new Error("진행 중인 예약만 변경할 수 있습니다.");
  if (booking.liveSession && ["LIVE", "ENDED"].includes(booking.liveSession.status)) throw new Error("이미 방송이 진행된 예약은 변경할 수 없습니다.");
  if (booking.startAt.getTime() === startAt.getTime() && booking.endAt.getTime() === endAt.getTime()) throw new Error("기존 일정과 같습니다.");

  const backToPending = isSeller && !isOwner && !isAdmin && booking.status === "APPROVED" && !booking.facility.autoApprove;
  const oldStart = booking.startAt, oldEnd = booking.endAt;
  const updated = await prisma.$transaction(async (tx) => {
    await lockFacility(tx, booking.facilityId);
    const reason = await checkBookingAvailability({ facilityId: booking.facilityId, startAt, endAt, excludeBookingId: booking.id, db: tx });
    if (reason) throw new Error(reason);
    const row = await tx.booking.update({
      where: { id: booking.id },
      data: {
        startAt, endAt, rescheduleCount: { increment: 1 },
        ...(backToPending && { status: "PENDING", approvedAt: null }),
      },
    });
    if (booking.liveSession && !["LIVE", "ENDED", "CANCELLED"].includes(booking.liveSession.status)) {
      await tx.liveSession.update({ where: { id: booking.liveSession.id }, data: { scheduledStart: startAt, scheduledEnd: endAt } });
    }
    return row;
  }, { timeout: 15000 });

  await audit({ actorId: user.id, action: "BOOKING_RESCHEDULE", entity: "Booking", entityId: booking.id, meta: { from: oldStart, to: startAt, backToPending } });
  const change = `${formatDateTime(oldStart)} → ${formatDateTime(startAt)}~${hhmm(endAt)}`;
  if (isSeller && !isAdmin) {
    await notify({
      userId: booking.facility.ownerId, type: "BOOKING",
      title: backToPending ? "셀러가 예약 일정 변경을 요청했습니다 (재승인 필요)" : "셀러가 예약 일정을 변경했습니다",
      body: `${booking.facility.name} · ${change}`, link: backToPending ? "/facility/bookings?status=PENDING" : "/facility/bookings",
    });
  } else {
    await notify({ userId: booking.sellerId, type: "BOOKING", title: "예약 일정이 변경되었습니다", body: `${booking.facility.name} · ${change}`, link: "/seller/bookings" });
  }
  await notifyWaitlist(booking.facilityId, oldStart, oldEnd);
  return updated;
}

// ---------------------------------------------------------------------------
// 예약 상품 확인: 창고 관리자가 상품별로 준비 가능/불가 표시
// ---------------------------------------------------------------------------
export async function updateBookingProducts(user: SessionUser, bookingId: string, items: { id: string; status: string; note?: string | null }[]) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { facility: { select: { ownerId: true, name: true } }, products: true } });
  if (!booking) throw new Error("예약을 찾을 수 없습니다.");
  if (booking.facility.ownerId !== user.id && user.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  const valid = new Set(booking.products.map((p) => p.id));
  let unavailable = 0;
  for (const it of items) {
    if (!valid.has(it.id) || !["REQUESTED", "CONFIRMED", "UNAVAILABLE"].includes(it.status)) continue;
    if (it.status === "UNAVAILABLE") unavailable++;
    await prisma.bookingProduct.update({ where: { id: it.id }, data: { status: it.status, facilityNote: it.note?.toString().slice(0, 200) || null } });
  }
  await audit({ actorId: user.id, action: "BOOKING_PRODUCTS_UPDATE", entity: "Booking", entityId: bookingId });
  if (unavailable > 0) {
    await notify({ userId: booking.sellerId, type: "BOOKING", title: "예약 상품 중 준비가 어려운 상품이 있습니다", body: `${booking.facility.name} · ${unavailable}개 상품`, link: "/seller/bookings" });
  }
  return prisma.bookingProduct.findMany({ where: { bookingId } });
}

// ---------------------------------------------------------------------------
// 현장 체크인 (창고(스튜디오) 관리자 · 최고관리자). 예약번호로도 찾을 수 있다.
// ---------------------------------------------------------------------------
export async function checkInBooking(user: SessionUser, bookingIdOrCode: string) {
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ id: bookingIdOrCode }, { code: bookingIdOrCode.trim().toUpperCase() }] },
    include: { facility: { select: { ownerId: true, name: true } } },
  });
  if (!booking) throw new Error("예약을 찾을 수 없습니다. 예약번호를 확인하세요.");
  if (booking.facility.ownerId !== user.id && user.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  if (booking.status !== "APPROVED") throw new Error("승인된 예약만 체크인할 수 있습니다.");
  if (booking.checkedInAt) return booking;
  const now = Date.now();
  if (now < booking.startAt.getTime() - 2 * 3600000) throw new Error("이용 시작 2시간 전부터 체크인할 수 있습니다.");
  if (now > booking.endAt.getTime()) throw new Error("이용 시간이 끝난 예약입니다.");
  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { checkedInAt: new Date() } });
  await audit({ actorId: user.id, action: "BOOKING_CHECKIN", entity: "Booking", entityId: booking.id });
  await notify({ userId: booking.sellerId, type: "BOOKING", title: "체크인되었습니다", body: `${booking.facility.name} · ${formatDateTime(booking.startAt)}`, link: "/seller/bookings" });
  return updated;
}
