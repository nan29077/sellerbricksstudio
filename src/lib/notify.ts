import { prisma } from "./prisma";

export type NotifyType = "BOOKING" | "INQUIRY" | "REVIEW" | "SETTLEMENT" | "MARKETING" | "SYSTEM";

// 사용자 알림 생성. 알림 실패가 본 처리(예약 승인 등)를 막지 않도록 오류는 무시한다.
export async function notify(params: {
  userId: string | string[]; type: NotifyType; title: string; body?: string | null; link?: string | null;
}) {
  const ids = Array.isArray(params.userId) ? params.userId : [params.userId];
  if (ids.length === 0) return;
  try {
    await prisma.userNotification.createMany({
      data: ids.map((userId) => ({
        userId, type: params.type, title: params.title.slice(0, 120),
        body: params.body?.slice(0, 500) ?? null, link: params.link ?? null,
      })),
    });
  } catch { /* 알림 실패는 무시 */ }
}

export async function notifyAdmins(params: Omit<Parameters<typeof notify>[0], "userId">) {
  try {
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
    await notify({ ...params, userId: admins.map((a) => a.id) });
  } catch { /* ignore */ }
}
