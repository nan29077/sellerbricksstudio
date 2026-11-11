import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { brandRecipients } from "@/lib/brand-access";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const NEXT: Record<string, string[]> = { PENDING: ["CONFIRMED"], CONFIRMED: ["PAID", "PENDING"], PAID: [] };

// PATCH { status?, adjustment?, memo? } — 확정 · 지급 · 수동 조정(정산 대기 상태에서만)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    const s = await prisma.brandSettlement.findUnique({ where: { id: params.id }, include: { brandShop: { select: { ownerId: true, name: true } } } });
    if (!s) return fail("정산서를 찾을 수 없습니다.", 404);
    const status = typeof b.status === "string" && b.status ? b.status : undefined;
    if (status && !(NEXT[s.status] ?? []).includes(status)) return fail("현재 상태에서 바꿀 수 없습니다.", 409);
    const raw = b.adjustment === undefined || b.adjustment === "" ? undefined : Math.round(Number(b.adjustment));
    const adjustment = raw === s.adjustment ? undefined : raw; // 바뀌지 않은 값은 무시
    if (adjustment !== undefined && (!Number.isFinite(adjustment) || Math.abs(adjustment) > 1_000_000_000)) return fail("조정 금액을 확인하세요.");
    if (adjustment !== undefined && s.status !== "PENDING") return fail("조정은 정산 대기 상태에서만 할 수 있습니다.", 409);
    const memo = typeof b.memo === "string" ? b.memo.slice(0, 500) : undefined;
    const adj = adjustment ?? s.adjustment;
    await prisma.brandSettlement.update({
      where: { id: s.id },
      data: {
        ...(status && { status: status as any }), ...(memo !== undefined && { memo }),
        ...(adjustment !== undefined && { adjustment: adj, payoutAmount: s.grossAmount - s.platformFee + s.autoAdjustment + adj }),
        ...(status === "CONFIRMED" && { confirmedAt: new Date() }), ...(status === "PAID" && { paidAt: new Date() }),
        ...(status === "PENDING" && { confirmedAt: null }),
      },
    });
    await audit({ actorId: admin.id, action: "BRAND_SETTLEMENT_UPDATE", entity: "BrandSettlement", entityId: s.id, meta: { status, adjustment, memo } });
    if (status === "PAID") await notify({ userId: await brandRecipients(s.brandShopId), type: "SETTLEMENT", title: "브랜드 정산금이 지급되었습니다", body: `${(s.grossAmount - s.platformFee + s.autoAdjustment + adj).toLocaleString()}원`, link: "/brand/settlements" });
    return ok({ id: s.id });
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const s = await prisma.brandSettlement.findUnique({ where: { id: params.id } });
    if (!s) return fail("정산서를 찾을 수 없습니다.", 404);
    if (s.status !== "PENDING") return fail("정산 대기 상태에서만 삭제할 수 있습니다.", 409);
    await prisma.$transaction([
      prisma.purchaseOrder.updateMany({ where: { brandSettlementId: s.id }, data: { brandSettlementId: null } }),
      prisma.brandRequest.updateMany({ where: { brandSettlementId: s.id }, data: { brandSettlementId: null } }),
      prisma.brandSettlementAdjustment.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } }),
      prisma.brandSettlement.delete({ where: { id: s.id } }),
    ]);
    await audit({ actorId: admin.id, action: "BRAND_SETTLEMENT_DELETE", entity: "BrandSettlement", entityId: s.id });
    return ok({ id: s.id });
  } catch (e) { return handleError(e); }
}
