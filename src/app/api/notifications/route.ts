import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

// GET: 최근 알림 30건 + 안 읽은 개수
export async function GET() {
  try {
    const user = await requireUser();
    const [items, unread] = await Promise.all([
      prisma.userNotification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.userNotification.count({ where: { userId: user.id, isRead: false } }),
    ]);
    return ok({ items, unread });
  } catch (e) { return handleError(e); }
}

// PATCH: { id } 하나 읽음 / { all: true } 전체 읽음
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const { id, all } = await req.json().catch(() => ({}));
    if (all) await prisma.userNotification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    else if (typeof id === "string") await prisma.userNotification.updateMany({ where: { id, userId: user.id }, data: { isRead: true } });
    return ok(true);
  } catch (e) { return handleError(e); }
}

// DELETE: 읽은 알림 정리
export async function DELETE() {
  try {
    const user = await requireUser();
    const r = await prisma.userNotification.deleteMany({ where: { userId: user.id, isRead: true } });
    return ok({ deleted: r.count });
  } catch (e) { return handleError(e); }
}
