import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

async function assertAccess(userId: string, role: string, sessionId: string) {
  const s = await prisma.liveSession.findUnique({ where: { id: sessionId }, include: { facility: true } });
  if (!s) throw new Error("세션을 찾을 수 없습니다.");
  if (!(s.sellerId === userId || s.facility.ownerId === userId || role === "SUPER_ADMIN")) throw new Error("FORBIDDEN");
  return s;
}

// 상품번호 변경 (방송 중 즉시) 또는 활성/스냅샷 수정
export async function PATCH(req: NextRequest, { params }: { params: { id: string; lspId: string } }) {
  try {
    const user = await requireUser();
    await assertAccess(user.id, user.role, params.id);
    const body = await req.json();
    const lsp = await prisma.liveSessionProduct.findUnique({ where: { id: params.lspId } });
    if (!lsp || lsp.liveSessionId !== params.id) return fail("상품을 찾을 수 없습니다.", 404);

    if (body.newNumber != null && body.newNumber !== lsp.displayNumber) {
      const newNumber = Number(body.newNumber);
      if (newNumber < 1) return fail("상품번호는 1 이상이어야 합니다.");
      const dup = await prisma.liveSessionProduct.findUnique({
        where: { liveSessionId_displayNumber: { liveSessionId: params.id, displayNumber: newNumber } },
      });
      if (dup) return fail("이미 사용 중인 상품번호입니다.", 409);

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.liveSessionProduct.update({ where: { id: params.lspId }, data: { displayNumber: newNumber } });
        await tx.liveProductNumberHistory.create({
          data: { liveSessionId: params.id, liveSessionProductId: params.lspId, oldNumber: lsp.displayNumber, newNumber, changedBy: user.id },
        });
        await tx.liveSession.update({ where: { id: params.id }, data: { numberVersion: { increment: 1 } } });
        return u;
      });
      await audit({ actorId: user.id, action: "LIVE_NUMBER_CHANGE", entity: "LiveSessionProduct", entityId: params.lspId, meta: { from: lsp.displayNumber, to: newNumber } });
      return ok(updated);
    }

    // 기타 수정(활성/재고/가격)
    const updated = await prisma.liveSessionProduct.update({
      where: { id: params.lspId },
      data: {
        isActive: body.isActive ?? undefined,
        stockSnapshot: body.stockSnapshot ?? undefined,
        priceSnapshot: body.priceSnapshot ?? undefined,
        nameSnapshot: body.nameSnapshot ?? undefined,
      },
    });
    await prisma.liveSession.update({ where: { id: params.id }, data: { numberVersion: { increment: 1 } } });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; lspId: string } }) {
  try {
    const user = await requireUser();
    await assertAccess(user.id, user.role, params.id);
    await prisma.liveSessionProduct.delete({ where: { id: params.lspId } });
    await prisma.liveSession.update({ where: { id: params.id }, data: { numberVersion: { increment: 1 } } });
    await audit({ actorId: user.id, action: "LIVE_PRODUCT_REMOVE", entity: "LiveSessionProduct", entityId: params.lspId });
    return ok({ deleted: true });
  } catch (e) { return handleError(e); }
}
