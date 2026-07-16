import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["SUPER_ADMIN"]);
    const { commissionType, commissionValue } = await req.json();
    const rule = await prisma.managerCommissionRule.upsert({
      where: { managerId: params.id },
      update: { commissionType, commissionValue: Number(commissionValue) },
      create: { managerId: params.id, commissionType, commissionValue: Number(commissionValue) },
    });
    await audit({ actorId: user.id, action: "MANAGER_COMMISSION_SET", entity: "ManagerCommissionRule", entityId: params.id, meta: { commissionType, commissionValue } });
    return ok(rule);
  } catch (e) { return handleError(e); }
}
