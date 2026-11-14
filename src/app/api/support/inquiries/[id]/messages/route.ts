import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { notify, notifyAdmins } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { isOwnUpload, supportFollowUpSchema } from "@/lib/support";

// POST /api/support/inquiries/[id]/messages — 고객 추가 문의 (회원: 본인 문의, 비회원: 확인 링크의 token)
//  답변 완료 · 종료된 문의에 추가로 물으면 다시 '새 문의'로 열어 운영팀이 이어서 답한다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) return fail("문의를 찾을 수 없습니다.", 404);
  const user = await getSessionUser();
  if (!(await consume(`support-msg:${user?.id ?? clientIp(request)}`, 20, 10 * MINUTE))) return fail("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.", 429);
  const input = supportFollowUpSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(input.error.issues[0].message);
  const { body, attachments = [], token } = input.data;
  const inquiry = await prisma.supportInquiry.findUnique({ where: { id: params.id }, select: { id: true, userId: true, guestToken: true, subject: true, status: true, assigneeId: true } });
  const owner = !!inquiry && ((!!user && inquiry.userId === user.id) || (!inquiry.userId && !!token && inquiry.guestToken === token));
  if (!inquiry || !owner) return fail("문의를 찾을 수 없습니다.", 404);
  if (attachments.length && !user) return fail("이미지 첨부는 로그인한 회원만 할 수 있습니다.");
  if (attachments.some((a) => !isOwnUpload(a))) return fail("첨부 이미지는 스토리지마켓에 올린 이미지만 쓸 수 있습니다.");
  const now = new Date();
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { inquiryId: inquiry.id, author: "USER", authorId: user?.id ?? null, body, attachments } }),
    prisma.supportInquiry.update({ where: { id: inquiry.id }, data: { lastUserReplyAt: now, status: inquiry.status === "IN_PROGRESS" ? "IN_PROGRESS" : "OPEN", closedAt: null } }),
  ]);
  const alert = { type: "INQUIRY" as const, title: "고객이 문의에 추가로 물었습니다", body: inquiry.subject, link: `/admin/support?q=${inquiry.id}` };
  if (inquiry.assigneeId) await notify({ userId: inquiry.assigneeId, ...alert }); else await notifyAdmins(alert);
  return ok({ id: inquiry.id }, 201);
}
