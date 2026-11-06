import { prisma } from "./prisma";
import { audit } from "./audit";
import { notify } from "./notify";
import { BOOKING_TRANSITIONS } from "./booking";
import { formatDateTime } from "./utils";
import type { SessionUser } from "./auth";

const LABEL: Record<string, string> = { APPROVED: "승인", REJECTED: "거절", CANCELLED: "취소", COMPLETED: "이용 완료" };

// 예약 상태 변경 (단건/일괄 공용). 실패 시 사유 문자열을 던진다.
export async function changeBookingStatus(user: SessionUser, bookingId: string, status: string, reason?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId }, include: { facility: { select: { id: true, name: true, ownerId: true } } },
  });
  if (!booking) throw new Error("예약을 찾을 수 없습니다.");

  const isOwner = booking.facility.ownerId === user.id;
  const isSeller = booking.sellerId === user.id;
  const isAdmin = user.role === "SUPER_ADMIN";

  if (status === "CANCELLED") {
    if (!isSeller && !isOwner && !isAdmin) throw new Error("취소 권한이 없습니다.");
  } else if (["APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
    if (!isOwner && !isAdmin) throw new Error("승인/거절 권한이 없습니다.");
  } else throw new Error("허용되지 않은 상태입니다.");

  if (!(BOOKING_TRANSITIONS[booking.status] ?? []).includes(status)) {
    throw new Error("현재 예약 상태에서는 이 처리를 할 수 없습니다.");
  }
  const text = String(reason ?? "").trim().slice(0, 300);
  if (status === "REJECTED" && !text) throw new Error("거절 사유를 입력하세요.");
  if (status === "CANCELLED" && !isSeller && !text) throw new Error("취소 사유를 입력하세요. (셀러에게 표시됩니다)");
  if (status === "APPROVED") {
    const clash = await prisma.booking.findFirst({
      where: {
        id: { not: booking.id }, facilityId: booking.facilityId, status: "APPROVED",
        startAt: { lt: booking.endAt }, endAt: { gt: booking.startAt },
      },
    });
    if (clash) throw new Error("같은 시간대에 이미 승인된 예약이 있습니다.");
  }
  if (status === "COMPLETED" && booking.startAt > new Date()) {
    throw new Error("이용 시작 전 예약은 완료 처리할 수 없습니다.");
  }

  const now = new Date();
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: status as any,
      rejectReason: status === "REJECTED" ? text : booking.rejectReason,
      cancelReason: status === "CANCELLED" ? (text || "셀러 요청으로 취소") : booking.cancelReason,
      approvedAt: status === "APPROVED" ? now : booking.approvedAt,
      cancelledAt: status === "CANCELLED" ? now : booking.cancelledAt,
      completedAt: status === "COMPLETED" ? now : booking.completedAt,
    },
  });
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
      body: `${booking.facility.name} · ${when}${text ? ` · 사유: ${text}` : ""}`,
      link: status === "COMPLETED" ? `/seller/bookings?status=COMPLETED` : `/seller/bookings`,
    });
  }
  return updated;
}
