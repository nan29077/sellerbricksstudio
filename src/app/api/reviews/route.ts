import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { refreshFacilityRating } from "@/lib/booking";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

const schema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  content: z.string().trim().min(5, "리뷰는 5자 이상 작성하세요.").max(1000),
});

// 셀러: 이용 완료 예약에 리뷰 작성
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const data = schema.parse(await req.json());
    const booking = await prisma.booking.findUnique({ where: { id: data.bookingId }, include: { facility: true, review: true } });
    if (!booking || booking.sellerId !== user.id) return fail("예약을 찾을 수 없습니다.", 404);
    if (booking.status !== "COMPLETED") return fail("이용 완료된 예약만 리뷰를 남길 수 있습니다.");
    if (booking.review) return fail("이미 리뷰를 작성했습니다.", 409);
    const review = await prisma.facilityReview.create({
      data: { bookingId: booking.id, facilityId: booking.facilityId, sellerId: user.id, rating: data.rating, content: data.content },
    });
    await refreshFacilityRating(booking.facilityId);
    await audit({ actorId: user.id, action: "REVIEW_CREATE", entity: "FacilityReview", entityId: review.id });
    await notify({
      userId: booking.facility.ownerId, type: "REVIEW", title: `새 리뷰 ★${data.rating}`,
      body: `${booking.facility.name} · ${data.content.slice(0, 60)}`, link: "/facility/reviews",
    });
    return ok(review, 201);
  } catch (e) { return handleError(e); }
}
