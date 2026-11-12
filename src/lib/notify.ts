import { prisma } from "./prisma";
import { appUrl, sendMail } from "./mailer";
import { SITE_NAME } from "./site-brand";

export type NotifyType = "BOOKING" | "INQUIRY" | "REVIEW" | "SETTLEMENT" | "MARKETING" | "SYSTEM" | "ORDER";
/** 설정 > 알림에서 켜고 끌 수 있는 묶음 */
export type NotifyCategory = "order" | "settlement" | "live";
export type NotifyPrefs = Record<NotifyCategory, boolean>;
export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = { order: true, settlement: true, live: true };

export function readNotifyPrefs(raw: unknown): NotifyPrefs {
  const v = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    order: v.order !== false,
    settlement: v.settlement !== false,
    live: v.live !== false,
  };
}

const categoryOf = (type: NotifyType, category?: NotifyCategory): NotifyCategory | null =>
  category ?? (type === "ORDER" ? "order" : type === "SETTLEMENT" ? "settlement" : null);

// 사용자 알림 생성. 알림 실패가 본 처리(예약 승인 등)를 막지 않도록 오류는 무시한다.
//  - 주문 · 정산 · 라이브 알림은 받는 사람이 설정에서 끈 경우 만들지 않는다.
//  - email: true 이면 앱 알림과 함께 메일도 보낸다. (메일 설정이 없으면 개발 서버 로그에만 남는다)
export async function notify(params: {
  userId: string | string[]; type: NotifyType; title: string; body?: string | null; link?: string | null;
  category?: NotifyCategory; email?: boolean;
}) {
  const ids = Array.from(new Set(Array.isArray(params.userId) ? params.userId : [params.userId])).filter(Boolean);
  if (ids.length === 0) return;
  try {
    const cat = categoryOf(params.type, params.category);
    let targets = ids;
    let users: { id: string; email: string; isActive: boolean; withdrawnAt: Date | null; profile: { notifyPrefs: unknown } | null }[] = [];
    if (cat || params.email) {
      users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, isActive: true, withdrawnAt: true, profile: { select: { notifyPrefs: true } } },
      });
      targets = users
        .filter((u) => !u.withdrawnAt && (!cat || readNotifyPrefs(u.profile?.notifyPrefs)[cat]))
        .map((u) => u.id);
    }
    if (!targets.length) return;
    await prisma.userNotification.createMany({
      data: targets.map((userId) => ({
        userId, type: params.type, title: params.title.slice(0, 120),
        body: params.body?.slice(0, 500) ?? null, link: params.link ?? null,
      })),
    });
    if (params.email) {
      const text = [params.title, params.body ?? "", params.link ? `바로 가기: ${appUrl(params.link)}` : ""].filter(Boolean).join("\n\n");
      for (const u of users) {
        if (!targets.includes(u.id) || !u.isActive || !u.email.includes("@")) continue;
        await sendMail(u.email, `[${SITE_NAME}] ${params.title}`.slice(0, 120), text).catch(() => null);
      }
    }
  } catch { /* 알림 실패는 무시 */ }
}

export async function notifyAdmins(params: Omit<Parameters<typeof notify>[0], "userId">) {
  try {
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
    await notify({ ...params, userId: admins.map((a) => a.id) });
  } catch { /* ignore */ }
}
