import { Role } from "@prisma/client";
import { prisma } from "./prisma";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "최고관리자",
  MANAGER: "중간관리자",
  FACILITY_ADMIN: "창고(스튜디오) 관리자",
  SELLER: "셀러",
  BUYER: "구매자",
};

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin/dashboard",
  MANAGER: "/manager/dashboard",
  FACILITY_ADMIN: "/facility/dashboard",
  SELLER: "/seller/dashboard",
  BUYER: "/",
};

export function can(role: Role | undefined, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}

// 중간관리자가 접근 가능한 시설 id 목록
export async function managerFacilityIds(managerId: string): Promise<string[]> {
  const rows = await prisma.managerFacility.findMany({
    where: { managerId }, select: { facilityId: true },
  });
  return rows.map((r) => r.facilityId);
}

// 창고(스튜디오) 관리자가 소유한 시설 id 목록
export async function ownedFacilityIds(ownerId: string): Promise<string[]> {
  const rows = await prisma.facility.findMany({ where: { ownerId }, select: { id: true } });
  return rows.map((r) => r.id);
}
