import type { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { sendMail, appUrl } from "./mailer";
import { notify, type NotifyCategory, type NotifyType } from "./notify";
import { SITE_NAME } from "./site-brand";
import { getSettings } from "./settings";
import type { SessionUser } from "./auth";

// ---------------------------------------------------------------------------
// 공간 운영 주체 (2026-11-14~)
//  외부 업체가 가입해서 여는 창고 계정은 없다. 창고는 본사가 직접 운영한다.
//   - 최고관리자: 모든 공간을 운영
//   - 창고 운영 매니저(MANAGER): 최고관리자가 담당으로 지정한 창고만 운영
//  Facility.ownerId 는 "본사 운영 계정"(최고관리자)이며 브랜드 거래(판매처 · 샘플 · 입고)의 주체로만 쓴다.
// ---------------------------------------------------------------------------

/** 창고 운영 콘솔(/facility)과 창고 운영 API를 쓸 수 있는 역할 */
export const FACILITY_OPERATOR_ROLES: Role[] = ["SUPER_ADMIN", "MANAGER"];

type Operator = Pick<SessionUser, "id" | "role">;

export const isFacilityOperatorRole = (role: Role | undefined | null) => !!role && FACILITY_OPERATOR_ROLES.includes(role);

/** 이 사용자가 운영할 수 있는 창고 조건 (Prisma Facility where) */
export function facilityScope(user: Operator | null | undefined): Prisma.FacilityWhereInput {
  if (user?.role === "SUPER_ADMIN") return {};
  if (user?.role === "MANAGER") return { managers: { some: { managerId: user.id } } };
  return { id: "__none__" };
}

/** 이 사용자가 운영할 수 있는 창고 id 목록 */
export async function operableFacilityIds(user: Operator | null | undefined): Promise<string[]> {
  if (!user || !isFacilityOperatorRole(user.role)) return [];
  if (user.role === "MANAGER" && (await getSettings()).managerDisabled) return [];
  const rows = await prisma.facility.findMany({ where: facilityScope(user), select: { id: true } });
  return rows.map((r) => r.id);
}

/** 이 창고를 운영할 수 있는지 (최고관리자 · 담당 매니저) */
export async function canOperateFacility(user: Operator | null | undefined, facilityId: string | null | undefined): Promise<boolean> {
  if (!user || !facilityId) return false;
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role !== "MANAGER") return false;
  if ((await getSettings()).managerDisabled) return false; // 창고 운영 매니저 비활성화
  const row = await prisma.managerFacility.findUnique({ where: { managerId_facilityId: { managerId: user.id, facilityId } }, select: { id: true } });
  return !!row;
}

/** 창고 운영 권한 확인 (없으면 FORBIDDEN) */
export async function assertFacilityAccess(user: Operator, facilityId: string) {
  const f = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true, ownerId: true, name: true } });
  if (!f) throw new Error("공간을 찾을 수 없습니다.");
  if (!(await canOperateFacility(user, f.id))) throw new Error("FORBIDDEN");
  return f;
}

/** 본사 운영 계정 = 가장 먼저 만든 최고관리자. 새 창고의 ownerId(브랜드 거래 주체)로 쓴다 */
export async function primaryAdminId(): Promise<string | null> {
  const a = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", isActive: true, withdrawnAt: null }, orderBy: { createdAt: "asc" }, select: { id: true },
  });
  return a?.id ?? null;
}

/** 창고 알림을 받는 사람: 최고관리자 전원 + 그 창고 담당 매니저 */
export async function facilityRecipients(facilityId: string | null | undefined): Promise<string[]> {
  if (!facilityId) return [];
  const [admins, managers] = await Promise.all([
    prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true, withdrawnAt: null }, select: { id: true } }),
    prisma.managerFacility.findMany({
      where: { facilityId, manager: { role: "MANAGER", isActive: true, withdrawnAt: null } }, select: { managerId: true },
    }),
  ]);
  return Array.from(new Set([...admins.map((a) => a.id), ...managers.map((m) => m.managerId)]));
}

/**
 * 창고 알림: 운영자(최고관리자 · 담당 매니저)에게 앱 알림을 보내고,
 * 제휴 창고에 담당자 메일이 있으면 partnerEmail: true 인 알림은 담당자에게도 메일로 보낸다. (계정 없이 메일만)
 * 알림 실패는 본 처리를 막지 않는다.
 */
export async function notifyFacility(facilityId: string | null | undefined, params: {
  type: NotifyType; title: string; body?: string | null; link?: string | null;
  category?: NotifyCategory; email?: boolean; partnerEmail?: boolean; exclude?: (string | null | undefined)[];
}) {
  if (!facilityId) return;
  try {
    const exclude = new Set((params.exclude ?? []).filter(Boolean));
    const ids = (await facilityRecipients(facilityId)).filter((id) => !exclude.has(id));
    const { partnerEmail, exclude: _ex, ...rest } = params;
    void _ex;
    if (ids.length) await notify({ ...rest, userId: ids });
    if (partnerEmail) {
      const f = await prisma.facility.findUnique({ where: { id: facilityId }, select: { name: true, operationType: true, partnerContactEmail: true } });
      const to = f?.operationType === "PARTNER" ? f.partnerContactEmail?.trim() : "";
      if (to && to.includes("@")) {
        const text = [`${f!.name}`, params.title, params.body ?? "", `${SITE_NAME} 본사에서 확인 후 처리합니다. 문의: ${appUrl("/")}`].filter(Boolean).join("\n\n");
        await sendMail(to, `[${SITE_NAME}] ${f!.name} · ${params.title}`.slice(0, 120), text).catch(() => null);
      }
    }
  } catch { /* 알림 실패는 무시 */ }
}
