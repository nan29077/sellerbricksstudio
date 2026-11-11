import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

const NEXT: Record<string, string[]> = { PENDING: ["CONFIRMED"], CONFIRMED: ["PAID", "PENDING"], PAID: [] };

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    const s = await prisma.settlement.findUnique({ where: { id: params.id } });
    if (!s) return fail("정산서를 찾을 수 없습니다.", 404);
    const status = typeof b.status === "string" ? b.status : undefined;
    if (status && !(NEXT[s.status] ?? []).includes(status)) return fail("현재 상태에서 바꿀 수 없습니다.", 409);
    const memo = typeof b.memo === "string" ? b.memo.slice(0, 500) : undefined;
    await prisma.settlement.update({
      where: { id: s.id },
      data: {
        ...(status && { status: status as any }), ...(memo !== undefined && { memo }),
        ...(status === "CONFIRMED" && { confirmedAt: new Date() }), ...(status === "PAID" && { paidAt: new Date() }),
        ...(status === "PENDING" && { confirmedAt: null }),
      },
    });
    await audit({ actorId: admin.id, action: "SALES_SETTLEMENT_UPDATE", entity: "Settlement", entityId: s.id, meta: { status, memo } });
    return ok({ id: s.id });
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const s = await prisma.settlement.findUnique({ where: { id: params.id } });
    if (!s) return fail("정산서를 찾을 수 없습니다.", 404);
    if (s.status !== "PENDING") return fail("정산 대기 상태에서만 삭제할 수 있습니다.", 409);
    await prisma.$transaction([
      prisma.order.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } }),
      prisma.salesAdjustment.updateMany({ where: { settlementId: s.id }, data: { settlementId: null } }),
      prisma.settlement.delete({ where: { id: s.id } }),
    ]);
    await audit({ actorId: admin.id, action: "SALES_SETTLEMENT_DELETE", entity: "Settlement", entityId: s.id });
    return ok({ id: s.id });
  } catch (e) { return handleError(e); }
}
