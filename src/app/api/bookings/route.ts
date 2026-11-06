import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { bookingSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { formatDateTime, parseKST } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { calcBookingPrice, checkBookingAvailability } from "@/lib/booking";
import { notify } from "@/lib/notify";

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
    if (!facility || facility.status !== "APPROVED") return fail("예약할 수 없는 창고(스튜디오)입니다.", 404);
    if (facility.capacity && data.headcount && data.headcount > facility.capacity) {
      return fail(`최대 수용 인원은 ${facility.capacity}명입니다.`);
    }

    // 운영시간 · 휴무일 · 요일 슬롯 · 최소 이용시간 · 중복 예약 검사
    const reason = await checkBookingAvailability({ facilityId: facility.id, startAt, endAt });
    if (reason) return fail(reason, 409);

    const booking = await prisma.booking.create({
      data: {
        facilityId: data.facilityId, sellerId: user.id, startAt, endAt,
        purpose: data.purpose, expectedProducts: data.expectedProducts, status: "PENDING",
        headcount: data.headcount ?? null, requestNote: data.requestNote?.trim() || null,
        totalPrice: calcBookingPrice(facility.basePrice, startAt, endAt),
      },
    });
    await audit({ actorId: user.id, action: "BOOKING_CREATE", entity: "Booking", entityId: booking.id });
    await notify({
      userId: facility.ownerId, type: "BOOKING", title: "새 예약 요청이 들어왔습니다",
      body: `${facility.name} · ${formatDateTime(startAt)}${data.purpose ? ` · ${data.purpose}` : ""}`,
      link: `/facility/bookings?status=PENDING`,
    });
    return ok(booking, 201);
  } catch (e) { return handleError(e); }
}
