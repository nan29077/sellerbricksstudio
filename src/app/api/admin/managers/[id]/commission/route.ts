import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["SUPER_ADMIN"]);
    const { commissionType, commissionValue: rawValue } = await req.json();
    const commissionValue = Number(rawValue);
    if (!["PERCENT", "FIXED"].includes(commissionType)) return fail("수수료 방식이 올바르지 않습니다.");
    if (!Number.isFinite(commissionValue) || commissionValue < 0) return fail("수수료는 0 이상의 숫자여야 합니다.");
    if (commissionType === "PERCENT" && commissionValue > 100) return fail("비율 수수료는 100%를 넘을 수 없습니다.");
    const manager = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
    if (!manager || manager.role !== "MANAGER") return fail("중간관리자를 찾을 수 없습니다.", 404);
    const rule = await prisma.managerCommissionRule.upsert({
      where: { managerId: params.id },
      update: { commissionType, commissionValue: Number(commissionValue) },
      create: { managerId: params.id, commissionType, commissionValue: Number(commissionValue) },
    });
    await audit({ actorId: user.id, action: "MANAGER_COMMISSION_SET", entity: "ManagerCommissionRule", entityId: params.id, meta: { commissionType, commissionValue } });
    return ok(rule);
  } catch (e) { return handleError(e); }
}
