import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notifyFacility } from "@/lib/facility-owner";

const LABEL: Record<string, string> = { APPROVED: "공개", SUSPENDED: "운영 정지", PENDING: "비공개(준비 중)로 변경" };

// PATCH { status?, reason?, feeRate? (null이면 플랫폼 기본값 사용) }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const f = await prisma.facility.findUnique({ where: { id: params.id }, select: { id: true, name: true, status: true } });
    if (!f) return fail("창고(스튜디오)를 찾을 수 없습니다.", 404);

    if (body.feeRate !== undefined) {
      if (body.feeRate === null || body.feeRate === "") {
        await prisma.commissionRule.deleteMany({ where: { scope: "FACILITY", facilityId: f.id } });
      } else {
        const rate = Number(body.feeRate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) return fail("수수료율은 0~100% 사이로 입력하세요.");
        await prisma.commissionRule.deleteMany({ where: { scope: "FACILITY", facilityId: f.id } });
        await prisma.commissionRule.create({ data: { scope: "FACILITY", facilityId: f.id, commissionType: "PERCENT", commissionValue: rate } });
      }
      await audit({ actorId: user.id, action: "FACILITY_FEE_SET", entity: "Facility", entityId: f.id, meta: { feeRate: body.feeRate } });
      if (!body.status) return ok({ id: f.id });
    }

    const { status } = body;
    if (!["PENDING", "APPROVED", "SUSPENDED"].includes(status)) return fail("허용되지 않은 상태입니다.");
    const reason = String(body.reason ?? "").trim().slice(0, 300);
    if (status === "SUSPENDED" && !reason) return fail("운영 정지 사유를 입력하세요. (담당 매니저에게 전달됩니다)");
    const updated = await prisma.facility.update({ where: { id: params.id }, data: { status } });
    await audit({ actorId: user.id, action: `FACILITY_${status}`, entity: "Facility", entityId: params.id, meta: reason ? { reason } : undefined });
    await notifyFacility(f.id, {
      type: "SYSTEM", title: `'${f.name}' ${LABEL[status]} 처리되었습니다`, exclude: [user.id],
      body: reason || (status === "APPROVED" ? "이제 셀러가 예약할 수 있습니다." : null), link: "/facility/profile",
    });
    return ok(updated);
  } catch (e) { return handleError(e); }
}
