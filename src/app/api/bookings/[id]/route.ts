import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { parseKST } from "@/lib/utils";
import { changeBookingStatus, checkInBooking, rescheduleBooking, updateBookingProducts } from "@/lib/booking-actions";
import { canOperateFacility } from "@/lib/facility-owner";

// PATCH /api/bookings/[id]
// - { status, reason? }               상태 변경: 창고(스튜디오) 관리자(승인/거절/완료/취소), 셀러(취소, 마감 전), 최고관리자(전체)
// - { action: "reschedule", startAt, endAt }  일정 변경 (셀러는 취소 마감 전까지, 승인된 예약은 재승인 필요)
// - { products: [{ id, status, note? }] }     예약 상품 준비 가능 여부 표시 (창고 관리자)
// - { facilityMemo }                  내부 메모 (창고 관리자 · 최고관리자 전용, 셀러 비공개)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));

    if (body.action === "reschedule") {
      if (typeof body.startAt !== "string" || typeof body.endAt !== "string") return fail("변경할 시간을 선택하세요.");
      const startAt = parseKST(body.startAt), endAt = parseKST(body.endAt);
      if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) return fail("예약 시간이 올바르지 않습니다.");
      try { return ok(await rescheduleBooking(user, params.id, startAt, endAt)); }
      catch (e) { const m = e instanceof Error ? e.message : "변경 실패"; if (m === "FORBIDDEN") throw e; return fail(m, 409); }
    }

    if (body.action === "checkin") {
      try { return ok(await checkInBooking(user, params.id)); }
      catch (e) { const m = e instanceof Error ? e.message : "체크인 실패"; if (m === "FORBIDDEN") throw e; return fail(m, 409); }
    }

    if (Array.isArray(body.products) && !body.status) {
      return ok(await updateBookingProducts(user, params.id, body.products));
    }

    if (typeof body.facilityMemo === "string" && !body.status) {
      const b = await prisma.booking.findUnique({ where: { id: params.id }, select: { facilityId: true } });
      if (!b) return fail("예약을 찾을 수 없습니다.", 404);
      if (!(await canOperateFacility(user, b.facilityId))) return fail("메모 권한이 없습니다.", 403);
      const updated = await prisma.booking.update({ where: { id: params.id }, data: { facilityMemo: body.facilityMemo.slice(0, 2000) || null } });
      await audit({ actorId: user.id, action: "BOOKING_MEMO", entity: "Booking", entityId: params.id });
      return ok(updated);
    }

    const updated = await changeBookingStatus(user, params.id, body.status, body.rejectReason ?? body.reason);
    return ok(updated);
  } catch (e) { return handleError(e); }
}
