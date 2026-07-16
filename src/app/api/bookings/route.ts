import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { bookingSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { parseKST } from "@/lib/utils";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const body = await req.json();
    const data = bookingSchema.parse(body);
    // 예약 일시는 항상 KST 기준으로 해석 (서버/사용자 로컬 타임존 무관)
    const startAt = parseKST(data.startAt);
    const endAt = parseKST(data.endAt);
    if (endAt <= startAt) return fail("종료 시간은 시작 시간보다 뒤여야 합니다.");

    const facility = await prisma.facility.findUnique({ where: { id: data.facilityId } });
    if (!facility || facility.status !== "APPROVED") return fail("예약할 수 없는 시설입니다.", 404);

    // 동일 시설 동일 시간대 중복 예약 방지 (PENDING/APPROVED 만 차단)
    const overlap = await prisma.booking.findFirst({
      where: {
        facilityId: data.facilityId,
        status: { in: ["PENDING", "APPROVED"] },
        startAt: { lt: endAt }, endAt: { gt: startAt },
      },
    });
    if (overlap) return fail("해당 시간대에 이미 예약이 있습니다. 다른 시간을 선택하세요.", 409);

    const booking = await prisma.booking.create({
      data: {
        facilityId: data.facilityId, sellerId: user.id, startAt, endAt,
        purpose: data.purpose, expectedProducts: data.expectedProducts, status: "PENDING",
      },
    });
    await audit({ actorId: user.id, action: "BOOKING_CREATE", entity: "Booking", entityId: booking.id });
    return ok(booking, 201);
  } catch (e) { return handleError(e); }
}
