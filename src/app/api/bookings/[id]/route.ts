import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

// 예약 상태 변경: 시설 운영자(승인/거절/완료), 셀러(취소)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { status, rejectReason } = await req.json();
    const booking = await prisma.booking.findUnique({ where: { id: params.id }, include: { facility: true } });
    if (!booking) return fail("예약을 찾을 수 없습니다.", 404);

    const isOwner = booking.facility.ownerId === user.id;
    const isSeller = booking.sellerId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN";

    if (status === "CANCELLED") {
      if (!isSeller && !isAdmin) return fail("취소 권한이 없습니다.", 403);
    } else if (["APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
      if (!isOwner && !isAdmin) return fail("승인/거절 권한이 없습니다.", 403);
    } else {
      return fail("허용되지 않은 상태입니다.");
    }

    const updated = await prisma.booking.update({
      where: { id: params.id }, data: { status, rejectReason: status === "REJECTED" ? rejectReason : null },
    });
    await audit({ actorId: user.id, action: `BOOKING_${status}`, entity: "Booking", entityId: booking.id });
    return ok(updated);
  } catch (e) { return handleError(e); }
}
