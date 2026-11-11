import { prisma } from "./prisma";
import { resolveProfileAvatar } from "./profile";
import type { SessionUser } from "./auth";

export async function getAccountAvatar(user: Pick<SessionUser, "id" | "email">) {
  const key = user.email ?? user.id;
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profileImageIndex: true, profile: { select: { avatarUrl: true } } },
    });
    return resolveProfileAvatar(dbUser?.profileImageIndex, dbUser?.profile?.avatarUrl, key);
  } catch {
    return resolveProfileAvatar(null, null, key);
  }
}
