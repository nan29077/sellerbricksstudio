import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/http";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { getPolicy } from "@/lib/policy";
import { lineInputOf, splitLine } from "@/lib/settlement";
import { couponBlockedReason, couponDiscount, findCoupon, normalizeCouponCode } from "@/lib/coupons";

// POST /api/coupons/check — 결제 화면에서 쿠폰 할인 금액 미리 보기 (실제 적용은 주문할 때 다시 계산)
const schema = z.object({
  sessionSlug: z.string().min(1),
  code: z.string().min(1, "쿠폰 코드를 입력하세요.").max(20),
  items: z.array(z.object({ liveSessionProductId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(99) })).min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    if (!(await consume(`coupon:ip:${clientIp(req)}`, 20, 10 * MINUTE))) return fail("쿠폰 확인을 너무 많이 시도했습니다. 잠시 후 다시 시도해 주세요.", 429);
    const data = schema.parse(await req.json().catch(() => ({})));
    const session = await prisma.liveSession.findUnique({ where: { slug: data.sessionSlug }, select: { id: true, sellerId: true, facilityId: true } });
    if (!session) return fail("방송을 찾을 수 없습니다.", 404);
    const lsps = await prisma.liveSessionProduct.findMany({
      where: { id: { in: data.items.map((i) => i.liveSessionProductId) }, liveSessionId: session.id, isActive: true },
      include: { facilityProduct: { select: { commissionType: true, commissionValue: true, brandProductId: true } } },
    });
    const map = new Map(lsps.map((l) => [l.id, l]));
    const policy = await getPolicy();
    let subtotal = 0, sellerCap = 0;
    for (const i of data.items) {
      const l = map.get(i.liveSessionProductId);
      if (!l) continue;
      const lineTotal = l.priceSnapshot * i.quantity;
      subtotal += lineTotal;
      sellerCap += splitLine(lineInputOf(l, { lineTotal, unitPrice: l.priceSnapshot, quantity: i.quantity }, { ownSpace: !session.facilityId }), policy).seller;
    }
    const code = normalizeCouponCode(data.code);
    const coupon = await findCoupon(code);
    const blocked = couponBlockedReason(coupon, session.sellerId, subtotal);
    if (blocked) return fail(blocked, 409);
    const discount = couponDiscount(coupon!, subtotal, sellerCap);
    if (discount <= 0) return fail("이 주문에는 쿠폰 할인을 적용할 수 없습니다.", 409);
    return ok({ code: coupon!.code, name: coupon!.name, discount });
  } catch (e) { return handleError(e); }
}
