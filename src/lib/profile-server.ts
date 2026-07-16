import { prisma } from "./prisma";
import { stableProfileIndex } from "./profile";
import type { SessionUser } from "./auth";

// 세션 사용자의 프로필 이미지 인덱스를 반환.
// DB에 profileImageIndex 가 있으면 그 값, 없으면(데모/미배정/ DB 미가동) email 기반 결정적 폴백.
export async function resolveProfileImageIndex(user: Pick<SessionUser, "id" | "email">): Promise<number> {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profileImageIndex: true },
    });
    if (dbUser?.profileImageIndex) return dbUser.profileImageIndex;
  } catch {
    // DB 미가동 등 — 폴백으로 진행
  }
  return stableProfileIndex(user.email ?? user.id);
}
