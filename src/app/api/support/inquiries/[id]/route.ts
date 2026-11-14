import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { SUPPORT_CATEGORIES, effectiveStatus, supportThread } from "@/lib/support";

// 채팅형 1:1 상담 (2026-11-14)
//  GET   /api/support/inquiries/[id]?token=  대화 불러오기 (회원: 본인 · 비회원: 확인 토큰) — 열어 보면 '읽음'으로 표시
//  PATCH /api/support/inquiries/[id]          { action: "close" | "rate", rating?, note?, token? } 상담 종료 · 만족도

async function ownInquiry(id: string, token: string | null | undefined) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const user = await getSessionUser();
  const row = await prisma.supportInquiry.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" }, select: { id: true, author: true, body: true, attachments: true, createdAt: true } } },
  });
  if (!row) return null;
  const owner = (!!user && row.userId === user.id) || (!row.userId && !!token && row.guestToken === token);
  return owner ? { row, user } : null;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const token = new URL(request.url).searchParams.get("token");
  const found = await ownInquiry(params.id, token).catch(() => null);
  if (!found) return fail("상담을 찾을 수 없습니다.", 404);
  const { row } = found;
  await prisma.supportInquiry.update({ where: { id: row.id }, data: { userReadAt: new Date(), updatedAt: row.updatedAt } }).catch(() => undefined);
  const status = effectiveStatus(row);
  return ok({
    id: row.id, subject: row.subject, category: SUPPORT_CATEGORIES[row.category].label, status, createdAt: row.createdAt,
    rating: row.rating, closed: status === "CLOSED",
    items: supportThread(row).map((m) => ({ ...m, at: m.at.toISOString() })),
  });
}

const patchSchema = z.object({
  action: z.enum(["close", "rate"]),
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().max(500).optional(),
  token: z.string().max(80).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = patchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(input.error.issues[0].message);
  const found = await ownInquiry(params.id, input.data.token).catch(() => null);
  if (!found) return fail("상담을 찾을 수 없습니다.", 404);
  if (!(await consume(`support-patch:${found.user?.id ?? clientIp(request)}`, 20, 10 * MINUTE))) return fail("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.", 429);
  const { row, user } = found;
  const now = new Date();
  if (input.data.action === "close") {
    await prisma.supportInquiry.update({ where: { id: row.id }, data: { status: "CLOSED", closedAt: now, ...(input.data.rating ? { rating: input.data.rating, ratingNote: input.data.note || null } : {}) } });
  } else {
    if (!input.data.rating) return fail("만족도를 골라 주세요.");
    await prisma.supportInquiry.update({ where: { id: row.id }, data: { rating: input.data.rating, ratingNote: input.data.note || null } });
  }
  await audit({ actorId: user?.id ?? null, action: input.data.action === "close" ? "SUPPORT_INQUIRY_CLOSE_BY_USER" : "SUPPORT_INQUIRY_RATE", entity: "SupportInquiry", entityId: row.id, meta: { rating: input.data.rating } });
  return ok({ id: row.id });
}
