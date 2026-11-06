import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

// PATCH /api/admin/users/[id]
// body: { isActive?: boolean, role?: "SELLER"|"FACILITY_ADMIN"|"MANAGER", adminMemo?: string, name?, phone?, companyName? }
// 정지된 계정은 로그인과 기존 세션 사용이 모두 막힌다.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const current = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
    if (current && body.role === current.role) delete body.role; // 변경 없음
    if (params.id === admin.id && (body.isActive === false || body.role)) return fail("본인 계정의 상태나 역할은 바꿀 수 없습니다.");

    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true, profile: { select: { id: true } } } });
    if (!target) return fail("회원을 찾을 수 없습니다.", 404);
    if (target.role === "SUPER_ADMIN" && (typeof body.isActive === "boolean" || body.role)) return fail("최고관리자 계정은 여기서 변경할 수 없습니다.", 403);

    const data: Record<string, unknown> = {};
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.role !== undefined) {
      if (!["SELLER", "FACILITY_ADMIN", "MANAGER"].includes(body.role)) return fail("변경할 수 없는 역할입니다.");
      data.role = body.role;
    }
    if (typeof body.adminMemo === "string") data.adminMemo = body.adminMemo.slice(0, 2000) || null;
    const profilePatch: Record<string, string | null> = {};
    for (const k of ["name", "phone", "companyName"] as const) if (typeof body[k] === "string") profilePatch[k] = body[k].trim().slice(0, 60) || null;
    if (profilePatch.name === null) return fail("이름은 비울 수 없습니다.");

    await prisma.user.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(Object.keys(profilePatch).length && {
          profile: target.profile ? { update: profilePatch } : { create: { name: (profilePatch.name as string) ?? "회원", ...profilePatch } },
        }),
      },
    });
    const action = typeof body.isActive === "boolean" ? (body.isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE") : body.role ? "USER_ROLE_CHANGE" : "USER_UPDATE";
    await audit({ actorId: admin.id, action, entity: "User", entityId: params.id, meta: { ...data, ...profilePatch, adminMemo: undefined } });
    if (body.role) await notify({ userId: params.id, type: "SYSTEM", title: "계정 역할이 변경되었습니다", body: "다시 로그인하면 새 메뉴가 적용됩니다." });
    return ok({ id: params.id, ...data });
  } catch (e) { return handleError(e); }
}
