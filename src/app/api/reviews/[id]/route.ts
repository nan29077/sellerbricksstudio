import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { refreshFacilityRating } from "@/lib/booking";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { canOperateFacility } from "@/lib/facility-owner";

// 셀러: { rating, content } 수정 / 창고(스튜디오): { reply } 답글 / 최고관리자: { isHidden } 숨김
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const review = await prisma.facilityReview.findUnique({ where: { id: params.id }, include: { facility: true } });
    if (!review) return fail("리뷰를 찾을 수 없습니다.", 404);

    if (typeof body.reply === "string") {
      if (!(await canOperateFacility(user, review.facilityId))) return fail("답글 권한이 없습니다.", 403);
      const reply = body.reply.trim().slice(0, 1000);
      const updated = await prisma.facilityReview.update({ where: { id: review.id }, data: { reply: reply || null, repliedAt: reply ? new Date() : null } });
      if (reply) await notify({ userId: review.sellerId, type: "REVIEW", title: "리뷰에 답글이 달렸습니다", body: `${review.facility.name} · ${reply.slice(0, 60)}`, link: "/seller/bookings?status=COMPLETED" });
      return ok(updated);
    }
    if (typeof body.isHidden === "boolean") {
      if (user.role !== "SUPER_ADMIN") return fail("권한이 없습니다.", 403);
      const updated = await prisma.facilityReview.update({ where: { id: review.id }, data: { isHidden: body.isHidden } });
      await refreshFacilityRating(review.facilityId);
      await audit({ actorId: user.id, action: body.isHidden ? "REVIEW_HIDE" : "REVIEW_SHOW", entity: "FacilityReview", entityId: review.id });
      return ok(updated);
    }
    if (review.sellerId !== user.id) return fail("본인 리뷰만 수정할 수 있습니다.", 403);
    const rating = Number(body.rating);
    const content = String(body.content ?? "").trim();
    if (!(rating >= 1 && rating <= 5) || content.length < 5) return fail("별점과 5자 이상의 내용을 입력하세요.");
    const updated = await prisma.facilityReview.update({ where: { id: review.id }, data: { rating: Math.round(rating), content: content.slice(0, 1000) } });
    await refreshFacilityRating(review.facilityId);
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const review = await prisma.facilityReview.findUnique({ where: { id: params.id } });
    if (!review) return fail("리뷰를 찾을 수 없습니다.", 404);
    if (review.sellerId !== user.id && user.role !== "SUPER_ADMIN") return fail("삭제 권한이 없습니다.", 403);
    await prisma.facilityReview.delete({ where: { id: review.id } });
    await refreshFacilityRating(review.facilityId);
    await audit({ actorId: user.id, action: "REVIEW_DELETE", entity: "FacilityReview", entityId: review.id });
    return ok(true);
  } catch (e) { return handleError(e); }
}
