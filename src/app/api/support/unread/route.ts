import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { hasUnreadForUser } from "@/lib/support";

// 안 읽은 상담 답변 수 (문의하기 버튼의 빨간 점) — 회원: GET · 비회원: POST { tokens }
const select = { id: true, lastAdminReplyAt: true, answeredAt: true, userReadAt: true } as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return ok({ count: 0, ids: [] });
  const rows = await prisma.supportInquiry.findMany({ where: { userId: user.id, OR: [{ lastAdminReplyAt: { not: null } }, { answeredAt: { not: null } }] }, select, take: 50, orderBy: { updatedAt: "desc" } }).catch(() => []);
  const ids = rows.filter(hasUnreadForUser).map((r) => r.id);
  return ok({ count: ids.length, ids });
}

export async function POST(request: Request) {
  if (!(await consume(`support-unread:${clientIp(request)}`, 60, 10 * MINUTE))) return fail("요청이 너무 잦습니다.", 429);
  const input = z.object({ tokens: z.array(z.string().min(10).max(80)).max(20) }).safeParse(await request.json().catch(() => null));
  if (!input.success || !input.data.tokens.length) return ok({ count: 0, ids: [], threads: [] });
  const rows = await prisma.supportInquiry.findMany({ where: { guestToken: { in: input.data.tokens }, userId: null }, select: { ...select, guestToken: true, subject: true, status: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: "desc" } }).catch(() => []);
  const ids = rows.filter(hasUnreadForUser).map((r) => r.id);
  return ok({ count: ids.length, ids, threads: rows.map((r) => ({ id: r.id, token: r.guestToken, subject: r.subject, status: r.status, updatedAt: r.updatedAt, unread: ids.includes(r.id) })) });
}
