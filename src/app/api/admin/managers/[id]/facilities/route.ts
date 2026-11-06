import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

// PUT { facilityIds: string[] } — 담당 창고(스튜디오) 전체 교체
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const { facilityIds } = await req.json().catch(() => ({}));
    if (!Array.isArray(facilityIds)) return fail("창고(스튜디오) 목록이 올바르지 않습니다.");
    const manager = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
    if (!manager || manager.role !== "MANAGER") return fail("중간관리자를 찾을 수 없습니다.", 404);
    const ids = Array.from(new Set(facilityIds.map(String)));
    const valid = await prisma.facility.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const before = await prisma.managerFacility.findMany({ where: { managerId: params.id }, select: { facilityId: true } });
    await prisma.$transaction([
      prisma.managerFacility.deleteMany({ where: { managerId: params.id, facilityId: { notIn: valid.map((v) => v.id) } } }),
      prisma.managerFacility.createMany({ data: valid.map((v) => ({ managerId: params.id, facilityId: v.id })), skipDuplicates: true }),
    ]);
    const added = valid.filter((v) => !before.some((b) => b.facilityId === v.id)).length;
    await audit({ actorId: admin.id, action: "MANAGER_FACILITIES_SET", entity: "User", entityId: params.id, meta: { count: valid.length } });
    if (added) await notify({ userId: params.id, type: "SYSTEM", title: `담당 창고(스튜디오) ${added}곳이 배정되었습니다`, link: "/manager/facilities" });
    return ok({ count: valid.length });
  } catch (e) { return handleError(e); }
}
