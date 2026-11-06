import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { changeBookingStatus } from "@/lib/booking-actions";

// 예약 상태 변경: 창고(스튜디오) 관리자(승인/거절/완료/취소), 셀러(취소), 최고관리자(전체)
// 메모 저장: { facilityMemo } — 창고(스튜디오) 관리자 · 최고관리자 전용 (셀러 비공개)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));

    if (typeof body.facilityMemo === "string" && !body.status) {
      const b = await prisma.booking.findUnique({ where: { id: params.id }, include: { facility: { select: { ownerId: true } } } });
      if (!b) return fail("예약을 찾을 수 없습니다.", 404);
      if (b.facility.ownerId !== user.id && user.role !== "SUPER_ADMIN") return fail("메모 권한이 없습니다.", 403);
      const updated = await prisma.booking.update({ where: { id: params.id }, data: { facilityMemo: body.facilityMemo.slice(0, 2000) || null } });
      await audit({ actorId: user.id, action: "BOOKING_MEMO", entity: "Booking", entityId: params.id });
      return ok(updated);
    }

    const updated = await changeBookingStatus(user, params.id, body.status, body.rejectReason ?? body.reason);
    return ok(updated);
  } catch (e) { return handleError(e); }
}
