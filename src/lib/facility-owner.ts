import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

// 창고(스튜디오) 관리자 본인 소유(또는 최고관리자) 확인
export async function assertFacilityAccess(user: SessionUser, facilityId: string) {
  const f = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true, ownerId: true, name: true } });
  if (!f) throw new Error("창고(스튜디오)를 찾을 수 없습니다.");
  if (user.role !== "SUPER_ADMIN" && f.ownerId !== user.id) throw new Error("FORBIDDEN");
  return f;
}
