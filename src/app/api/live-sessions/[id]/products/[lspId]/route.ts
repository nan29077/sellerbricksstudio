import type { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { liveProductLimits } from "@/lib/brand-links";
import { canOperateFacility } from "@/lib/facility-owner";

const editSchema = z.object({
  isActive: z.boolean().optional(),
  stockSnapshot: z.coerce.number().int().min(0, "재고는 0 이상이어야 합니다.").max(1_000_000).optional(),
  priceSnapshot: z.coerce.number().int().min(0, "가격은 0 이상이어야 합니다.").max(100_000_000).optional(),
  nameSnapshot: z.string().trim().min(1, "상품명을 입력하세요.").max(100).optional(),
}).strip();

async function assertAccess(user: { id: string; role: Role }, sessionId: string) {
  const s = await prisma.liveSession.findUnique({ where: { id: sessionId }, include: { facility: true } });
  if (!s) throw new Error("세션을 찾을 수 없습니다.");
  const operator = user.role === "SUPER_ADMIN" || (await canOperateFacility(user, s.facilityId));
  if (!(s.sellerId === user.id || operator)) throw new Error("FORBIDDEN");
  return { ...s, operator };
}

// 상품번호 변경 (방송 중 즉시) 또는 활성/스냅샷 수정
export async function PATCH(req: NextRequest, { params }: { params: { id: string; lspId: string } }) {
  try {
    const user = await requireUser();
    const session = await assertAccess(user, params.id);
    const body = await req.json();
    const lsp = await prisma.liveSessionProduct.findUnique({ where: { id: params.lspId } });
    if (!lsp || lsp.liveSessionId !== params.id) return fail("상품을 찾을 수 없습니다.", 404);

    if (body.newNumber != null && body.newNumber !== lsp.displayNumber) {
      const newNumber = Number(body.newNumber);
      if (!Number.isInteger(newNumber) || newNumber < 1 || newNumber > 9999) return fail("상품번호는 1~9999 사이의 정수여야 합니다.");
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

    // 기타 수정(활성/재고/가격/이름) — 값 형식과 범위를 확인한다.
    const patch = editSchema.safeParse(body);
    if (!patch.success) return fail(patch.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
    const admin = user.role === "SUPER_ADMIN";
    const changesPrice = patch.data.priceSnapshot !== undefined && patch.data.priceSnapshot !== lsp.priceSnapshot;
    const changesStock = patch.data.stockSnapshot !== undefined && patch.data.stockSnapshot !== lsp.stockSnapshot;
    if ((changesPrice || changesStock) && !admin && (session.status === "ENDED" || session.status === "CANCELLED")) {
      return fail("종료되거나 취소된 방송의 가격·재고는 바꿀 수 없습니다.", 409);
    }
    if ((changesPrice || changesStock) && !admin) {
      const limits = await liveProductLimits(prisma, lsp.id);
      if (limits && changesPrice) {
        const isFacilityOwner = session.operator; // 방송 장소 창고 운영자
        if (limits.sellerPriceLocked && !isFacilityOwner) return fail("수수료 방식 창고(스튜디오) 상품은 창고(스튜디오)가 정한 가격으로만 팔 수 있습니다. 창고(스튜디오)에 공급가 설정을 요청해 주세요.", 403);
        if (patch.data.priceSnapshot! < limits.floor) return fail(`판매가는 ${limits.floor.toLocaleString()}원(공급가 · 브랜드 최저 판매가) 아래로 정할 수 없습니다.`);
      }
      if (limits && changesStock && limits.maxStock != null && patch.data.stockSnapshot! > limits.maxStock) {
        return fail(`판매 수량은 실제 재고(${limits.maxStock.toLocaleString()}개)를 넘을 수 없습니다.`);
      }
    }
    const updated = await prisma.liveSessionProduct.update({
      where: { id: params.lspId },
      data: patch.data,
    });
    await prisma.liveSession.update({ where: { id: params.id }, data: { numberVersion: { increment: 1 } } });
    if (changesPrice || changesStock) await audit({ actorId: user.id, action: "LIVE_PRODUCT_EDIT", entity: "LiveSessionProduct", entityId: lsp.id, meta: { price: changesPrice ? [lsp.priceSnapshot, patch.data.priceSnapshot] : undefined, stock: changesStock ? [lsp.stockSnapshot, patch.data.stockSnapshot] : undefined } });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; lspId: string } }) {
  try {
    const user = await requireUser();
    await assertAccess(user, params.id);
    const lsp = await prisma.liveSessionProduct.findFirst({
      where: { id: params.lspId, liveSessionId: params.id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!lsp) return fail("상품을 찾을 수 없습니다.", 404);
    // 이미 주문된 상품은 주문 내역 보존을 위해 판매만 중단한다.
    const softDeleted = lsp._count.orderItems > 0;
    if (softDeleted) {
      await prisma.liveSessionProduct.update({ where: { id: lsp.id }, data: { isActive: false } });
    } else {
      await prisma.liveSessionProduct.delete({ where: { id: lsp.id } });
    }
    await prisma.liveSession.update({ where: { id: params.id }, data: { numberVersion: { increment: 1 } } });
    await audit({ actorId: user.id, action: "LIVE_PRODUCT_REMOVE", entity: "LiveSessionProduct", entityId: params.lspId, meta: { softDeleted } });
    return ok({ deleted: true, softDeleted });
  } catch (e) { return handleError(e); }
}
