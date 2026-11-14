import { z } from "zod";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { appUrl, sendMail } from "@/lib/mailer";
import { SUPPORT_STATUS, isOwnUpload } from "@/lib/support";

// PATCH /api/admin/support/[id] — 최고관리자 문의 처리
//  { reply?, attachments?, status?, priority?, assigneeId?, adminMemo? }
//  - reply: 답변을 대화에 남기고 고객에게 알린다 (회원: 앱 알림, 비회원: 이메일 + 확인 링크). 상태는 status 가 없으면 '답변 완료'
//  - status: OPEN · IN_PROGRESS · ANSWERED · CLOSED / priority: LOW · NORMAL · HIGH · URGENT / assigneeId: 담당 최고관리자(빈 값이면 해제)
const schema = z.object({
  reply: z.string().trim().min(2, "답변을 입력해 주세요.").max(3000, "답변은 3,000자까지 입력할 수 있습니다.").optional(),
  attachments: z.array(z.string().max(500)).max(5).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "ANSWERED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().max(64).nullable().optional(),
  adminMemo: z.string().max(3000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await getSessionUser();
  if (!admin) return fail("로그인이 필요합니다.", 401);
  if (admin.role !== "SUPER_ADMIN") return fail("접근 권한이 없습니다.", 403);
  if (!z.string().uuid().safeParse(params.id).success) return fail("문의를 찾을 수 없습니다.", 404);
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(input.error.issues[0].message);
  const { reply, attachments = [], status, priority, assigneeId, adminMemo } = input.data;
  if (reply === undefined && status === undefined && priority === undefined && assigneeId === undefined && adminMemo === undefined) return fail("바꿀 내용이 없습니다.");
  if (attachments.some((a) => !isOwnUpload(a))) return fail("첨부 이미지는 스토리지마켓에 올린 이미지만 쓸 수 있습니다.");

  try {
    const account = await prisma.user.findFirst({ where: { id: admin.id, role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
    if (!account) return fail("등록된 최고관리자 계정이 필요합니다.", 403);
    const inquiry = await prisma.supportInquiry.findUnique({ where: { id: params.id }, select: { id: true, userId: true, guestEmail: true, guestName: true, guestToken: true, subject: true, answeredAt: true } });
    if (!inquiry) return fail("문의를 찾을 수 없습니다.", 404);
    if (assigneeId) {
      const ok2 = await prisma.user.findFirst({ where: { id: assigneeId, role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
      if (!ok2) return fail("담당자는 최고관리자 계정만 지정할 수 있습니다.");
    }
    const now = new Date();
    const nextStatus = status ?? (reply ? "ANSWERED" : undefined);
    await prisma.$transaction(async (tx) => {
      if (reply) await tx.supportMessage.create({ data: { inquiryId: inquiry.id, author: "ADMIN", authorId: admin.id, body: reply, attachments } });
      await tx.supportInquiry.update({
        where: { id: inquiry.id },
        data: {
          ...(reply ? { reply, answeredAt: inquiry.answeredAt ?? now } : {}),
          ...(nextStatus ? { status: nextStatus, closedAt: nextStatus === "CLOSED" ? now : null } : {}),
          ...(priority ? { priority } : {}),
          ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
          ...(adminMemo !== undefined ? { adminMemo: adminMemo?.trim() || null } : {}),
          ...(!reply && !nextStatus && assigneeId ? { status: "IN_PROGRESS" } : {}),
        },
      });
    });
    await audit({ actorId: admin.id, action: reply ? "SUPPORT_INQUIRY_REPLY" : "SUPPORT_INQUIRY_UPDATE", entity: "SupportInquiry", entityId: inquiry.id, meta: { status: nextStatus, priority, assigneeId } });

    if (reply) {
      if (inquiry.userId) {
        await notify({ userId: inquiry.userId, type: "INQUIRY", title: "고객 문의에 답변이 등록되었습니다", body: inquiry.subject, link: `/support/${inquiry.id}` });
      } else if (inquiry.guestEmail && inquiry.guestToken) {
        const link = appUrl(`/support/guest/${inquiry.guestToken}`);
        await sendMail(inquiry.guestEmail, `[스토리지마켓] 문의 답변: ${inquiry.subject}`, [
          `${inquiry.guestName ?? "고객"}님, 문의하신 내용에 운영팀이 답변했습니다.`, "", reply, "", `답변 전체 보기 · 추가 문의: ${link}`,
        ].join("\n")).catch(() => null);
      }
    }
    if (assigneeId && assigneeId !== admin.id) await notify({ userId: assigneeId, type: "INQUIRY", title: "고객 문의 담당자로 지정되었습니다", body: inquiry.subject, link: `/admin/support?q=${inquiry.id}` });
    return ok({ id: inquiry.id, status: nextStatus ? SUPPORT_STATUS[nextStatus].label : undefined });
  } catch (error) {
    console.error("Support inquiry update failed", error instanceof Error ? error.name : "UnknownError");
    return fail("처리에 실패했습니다. 잠시 후 다시 시도해 주세요.", 503);
  }
}
