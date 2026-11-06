import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

// PUT { rate } — 플랫폼 기본 수수료율(%) 변경 (이후 생성되는 정산서부터 적용)
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const { rate } = await req.json().catch(() => ({}));
    const v = Number(rate);
    if (!Number.isFinite(v) || v < 0 || v > 100) return fail("수수료율은 0~100% 사이로 입력하세요.");
    await prisma.commissionRule.create({ data: { scope: "PLATFORM", commissionType: "PERCENT", commissionValue: v } });
    await audit({ actorId: admin.id, action: "PLATFORM_FEE_SET", entity: "CommissionRule", meta: { rate: v } });
    return ok({ rate: v });
  } catch (e) { return handleError(e); }
}
