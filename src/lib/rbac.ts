import { Role } from "@prisma/client";
import { prisma } from "./prisma";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "최고관리자",
  MANAGER: "창고 운영 매니저",
  FACILITY_ADMIN: "(사용 안 함) 예전 창고 관리자",
  BRAND_ADMIN: "브랜드사",
  SELLER: "셀러",
  BUYER: "구매자",
};

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin/dashboard",
  MANAGER: "/manager/dashboard",
  FACILITY_ADMIN: "/", // 없어진 역할 (로그인 불가)
  BRAND_ADMIN: "/brand/dashboard",
  SELLER: "/seller/dashboard",
  BUYER: "/",
};

export function can(role: Role | undefined, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}

// 중간관리자가 접근 가능한 공간 id 목록
export async function managerFacilityIds(managerId: string): Promise<string[]> {
  const rows = await prisma.managerFacility.findMany({
    where: { managerId }, select: { facilityId: true },
  });
  return rows.map((r) => r.facilityId);
}

