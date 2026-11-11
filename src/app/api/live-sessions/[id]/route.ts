import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

// PATCH /api/live-sessions/[id] — 방송 배송비 설정 (셀러 · 방송 장소 창고(스튜디오) 관리자 · 최고관리자)
//  shippingFee: 0 이면 무료배송(상품가에 포함), freeShippingOver: 이 금액 이상 주문하면 무료 (비우면 조건 없음)
//  이미 들어온 주문에는 영향을 주지 않는다. (주문할 때 배송비가 확정됨)
const schema = z.object({
  shippingFee: z.coerce.number().int().min(0, "배송비는 0원 이상입니다.").max(100_000, "배송비는 10만 원까지 정할 수 있습니다."),
  freeShippingOver: z.union([z.coerce.number().int().min(0).max(100_000_000), z.null()]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const s = await prisma.liveSession.findUnique({ where: { id: params.id }, include: { facility: { select: { ownerId: true } } } });
    if (!s) return fail("방송을 찾을 수 없습니다.", 404);
    if (!(s.sellerId === user.id || s.facility?.ownerId === user.id || user.role === "SUPER_ADMIN")) return fail("권한이 없습니다.", 403);
    if (s.status === "CANCELLED") return fail("취소된 방송은 바꿀 수 없습니다.", 409);
    const data = schema.parse(await req.json().catch(() => ({})));
    const freeShippingOver = data.shippingFee > 0 && data.freeShippingOver ? data.freeShippingOver : null;
    const updated = await prisma.liveSession.update({
      where: { id: s.id }, data: { shippingFee: data.shippingFee, freeShippingOver },
      select: { id: true, shippingFee: true, freeShippingOver: true },
    });
    await audit({ actorId: user.id, action: "LIVE_SHIPPING_UPDATE", entity: "LiveSession", entityId: s.id, meta: { from: { fee: s.shippingFee, over: s.freeShippingOver }, to: updated } });
    return ok(updated);
  } catch (e) { return handleError(e); }
}
