import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { brandContext } from "@/lib/brand-access";

const schema = z.object({
  userId: z.string().min(1).max(64),
  status: z.enum(["APPROVED", "BLOCKED", "REMOVE"]),
  note: z.string().trim().max(300).default(""),
});

// POST /api/brand-partners — 브랜드(대표·팀원): 판매처(셀러 · 스토리지마켓 창고) 승인 · 차단 · 해제
//  - 차단하면 그 판매처의 이 브랜드 상품 판매(셀러 판매 목록 · 창고 판매 상품 · 진행 중 방송 상품)를 바로 멈춘다.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const ctx = await brandContext(user);
    if (!ctx) return fail("브랜드사 계정이 필요합니다.", 403);
    const data = schema.parse(await req.json().catch(() => ({})));
    const partner = await prisma.user.findFirst({ where: { id: data.userId, role: { in: ["SELLER", "SUPER_ADMIN"] } }, select: { id: true } });
    if (!partner) return fail("판매처 계정을 찾지 못했습니다.", 404);
    const shopId = ctx.shop.id;

    if (data.status === "REMOVE") {
      await prisma.brandPartner.deleteMany({ where: { shopId, userId: partner.id } });
    } else {
      await prisma.brandPartner.upsert({
        where: { shopId_userId: { shopId, userId: partner.id } },
        update: { status: data.status, note: data.note }, create: { shopId, userId: partner.id, status: data.status, note: data.note },
      });
    }
    let stopped = 0;
    if (data.status === "BLOCKED") {
      const brandWhere = { shopId };
      stopped = await prisma.$transaction(async (tx) => {
        await tx.sellerBrandProduct.updateMany({ where: { sellerId: partner.id, brandProduct: brandWhere }, data: { isActive: false } });
        await tx.facilityProduct.updateMany({ where: { facility: { ownerId: partner.id }, brandProduct: brandWhere }, data: { isSellable: false } });
        const live = await tx.liveSessionProduct.findMany({
          where: {
            isActive: true, brandProduct: brandWhere, liveSession: { status: { in: ["DRAFT", "READY", "LIVE"] } },
            OR: [{ liveSession: { sellerId: partner.id } }, { liveSession: { facility: { ownerId: partner.id } } }],
          },
          select: { id: true, liveSessionId: true },
        });
        if (live.length) {
          await tx.liveSessionProduct.updateMany({ where: { id: { in: live.map((l) => l.id) } }, data: { isActive: false } });
          await tx.liveSession.updateMany({ where: { id: { in: Array.from(new Set(live.map((l) => l.liveSessionId))) } }, data: { numberVersion: { increment: 1 } } });
        }
        return live.length;
      });
    }
    await audit({ actorId: user.id, action: `BRAND_PARTNER_${data.status}`, entity: "BrandShop", entityId: shopId, meta: { partner: partner.id, stopped } });
    const title = data.status === "APPROVED" ? `${ctx.shop.name} 판매처로 승인되었습니다` : data.status === "BLOCKED" ? `${ctx.shop.name}와의 거래가 중지되었습니다` : `${ctx.shop.name} 판매처 등록이 해제되었습니다`;
    await notify({ userId: partner.id, type: "SYSTEM", title, body: data.note || (data.status === "APPROVED" ? "이제 상품을 판매 목록에 담을 수 있습니다." : undefined), link: `/brands/${shopId}` });
    return ok({ status: data.status, stopped });
  } catch (e) { return handleError(e); }
}
