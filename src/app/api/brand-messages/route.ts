import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/http";
import { notify } from "@/lib/notify";
import { BRAND_BUYER_ROLES } from "@/lib/brands";
import { brandContext, brandRecipients } from "@/lib/brand-access";
import { consume, MINUTE } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { detectContactInfo, DIRECT_TRADE_WARNING } from "@/lib/contact-detect";

const schema = z.object({
  body: z.string().trim().min(1, "내용을 입력하세요.").max(2000),
  threadId: z.string().max(64).optional(),
  shopId: z.string().max(64).optional(),     // 판매처가 브랜드에 처음 문의할 때
  partnerId: z.string().max(64).optional(),  // 브랜드가 판매처에 처음 메시지를 보낼 때
});

// POST /api/brand-messages — 브랜드 ↔ 판매처(셀러 · 창고 관리자) 1:1 문의
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = schema.parse(await req.json().catch(() => ({})));
    if (!(await consume(`msg:${user.id}`, 60, 10 * MINUTE))) return fail("메시지를 너무 많이 보냈습니다. 잠시 후 다시 시도해 주세요.", 429);
    const ctx = await brandContext(user);
    let thread;
    if (ctx) {
      // 브랜드 쪽
      if (data.threadId) thread = await prisma.brandThread.findFirst({ where: { id: data.threadId, shopId: ctx.shop.id } });
      else if (data.partnerId) {
        const partner = await prisma.user.findFirst({ where: { id: data.partnerId, role: { in: BRAND_BUYER_ROLES }, isActive: true }, select: { id: true } });
        if (!partner) return fail("판매처 계정을 찾지 못했습니다.", 404);
        thread = await prisma.brandThread.upsert({ where: { shopId_partnerId: { shopId: ctx.shop.id, partnerId: partner.id } }, update: {}, create: { shopId: ctx.shop.id, partnerId: partner.id } });
      }
      if (!thread) return fail("대화를 찾지 못했습니다.", 404);
    } else if (BRAND_BUYER_ROLES.includes(user.role)) {
      // 판매처 쪽
      if (data.threadId) thread = await prisma.brandThread.findFirst({ where: { id: data.threadId, partnerId: user.id } });
      else if (data.shopId) {
        const shop = await prisma.brandShop.findFirst({ where: { id: data.shopId, status: "APPROVED" }, select: { id: true } });
        if (!shop) return fail("브랜드샵을 찾지 못했습니다.", 404);
        const blocked = await prisma.brandPartner.findFirst({ where: { shopId: shop.id, userId: user.id, status: "BLOCKED" }, select: { id: true } });
        if (blocked) return fail("이 브랜드와의 거래가 중지되어 문의할 수 없습니다.", 403);
        thread = await prisma.brandThread.upsert({ where: { shopId_partnerId: { shopId: shop.id, partnerId: user.id } }, update: {}, create: { shopId: shop.id, partnerId: user.id } });
      }
      if (!thread) return fail("대화를 찾지 못했습니다.", 404);
    } else return fail("브랜드 문의는 브랜드사 · 셀러 · 창고(스튜디오) 계정으로 이용할 수 있습니다.", 403);

    const fromBrand = !!ctx;
    // 직거래 의심(전화번호·계좌번호 등): 보내기는 허용하고 메시지에 표시 + 감사 기록
    const contacts = detectContactInfo(data.body);
    const flagged = contacts.length > 0;
    const [message] = await prisma.$transaction([
      prisma.brandMessage.create({ data: { threadId: thread.id, senderId: user.id, body: data.body, flagged }, select: { id: true } }),
      prisma.brandThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: new Date(), ...(fromBrand ? { partnerUnread: { increment: 1 } } : { brandUnread: { increment: 1 } }) },
      }),
    ]);
    const shop = await prisma.brandShop.findUnique({ where: { id: thread.shopId }, select: { name: true } });
    await notify({
      userId: fromBrand ? thread.partnerId : await brandRecipients(thread.shopId), type: "SYSTEM",
      title: fromBrand ? `${shop?.name ?? "브랜드"}에서 메시지가 왔습니다` : "판매처 문의가 도착했습니다",
      body: data.body.slice(0, 120), link: fromBrand ? `/brand-messages?t=${thread.id}` : `/brand/messages?t=${thread.id}`,
    });
    if (flagged) await audit({ actorId: user.id, action: "BRAND_MESSAGE_CONTACT_FLAG", entity: "BrandMessage", entityId: message.id, meta: { threadId: thread.id, shopId: thread.shopId, contacts } });
    return ok({ threadId: thread.id, ...(flagged && { warning: DIRECT_TRADE_WARNING }) }, 201);
  } catch (e) { return handleError(e); }
}
