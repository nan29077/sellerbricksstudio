import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { CLAIM_LABEL } from "@/lib/order-claims";
import { notify } from "@/lib/notify";
import { notifyBuyer } from "@/lib/order-notify";
import { audit } from "@/lib/audit";
import { canOperateFacility, notifyFacility } from "@/lib/facility-owner";

// PATCH /api/order-claims/[id] — 판매자 답변 (셀러 · 방송 장소 창고 운영자(최고관리자 · 담당 매니저))
//  RESOLVED: 처리 완료 (취소 · 환불은 주문 화면의 기존 버튼으로 먼저 처리한 뒤 누른다)
//  REJECTED: 처리 불가 (사유 필수)
const schema = z.object({
  status: z.enum(["RESOLVED", "REJECTED"]),
  answer: z.string().trim().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const data = schema.parse(await req.json().catch(() => ({})));
    const claim = await prisma.orderClaim.findUnique({
      where: { id: params.id },
      include: { order: { select: { id: true, orderNo: true, sellerId: true, facilityId: true } } },
    });
    if (!claim) return fail("요청을 찾을 수 없습니다.", 404);
    const o = claim.order;
    const isFacility = !!o.facilityId && (await canOperateFacility(user, o.facilityId));
    if (!(user.role === "SUPER_ADMIN" || o.sellerId === user.id || isFacility)) return fail("이 요청을 처리할 권한이 없습니다.", 403);
    if (data.status === "REJECTED" && !data.answer) return fail("처리할 수 없는 이유를 구매자에게 남겨 주세요.");

    const r = await prisma.orderClaim.updateMany({
      where: { id: claim.id, status: "REQUESTED" },
      data: { status: data.status, answer: data.answer || null, resolvedBy: user.id, resolvedAt: new Date() },
    });
    if (!r.count) return fail("이미 처리되었거나 구매자가 거둔 요청입니다. 새로고침해 주세요.", 409);

    const label = CLAIM_LABEL[claim.type];
    await notifyBuyer(o.id, { kind: "CLAIM_ANSWERED", label, accepted: data.status === "RESOLVED", answer: data.answer });
    // 셀러 · 창고 중 처리하지 않은 쪽에 알린다
    const title = `${label} 요청 ${data.status === "RESOLVED" ? "처리 완료" : "처리 불가"} · ${o.orderNo}`;
    if (o.sellerId !== user.id) await notify({ userId: o.sellerId, type: "ORDER", title, body: data.answer ?? null });
    if (o.facilityId) await notifyFacility(o.facilityId, { type: "ORDER", title, body: data.answer ?? null, exclude: [user.id, o.sellerId] });
    await audit({ actorId: user.id, action: `ORDER_CLAIM_${data.status}`, entity: "Order", entityId: o.id, meta: { claimId: claim.id, answer: data.answer } });
    return ok({ id: claim.id, status: data.status });
  } catch (e) { return handleError(e); }
}
