import { z } from "zod";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { supportReplySchema } from "@/lib/support";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await getSessionUser();
  if (!admin) return fail("로그인이 필요합니다.", 401);
  if (admin.role !== "SUPER_ADMIN") return fail("접근 권한이 없습니다.", 403);
  if (!z.string().uuid().safeParse(params.id).success) return fail("문의를 찾을 수 없습니다.", 404);
  const input = supportReplySchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(input.error.issues[0].message);

  const { id } = params;
  const { reply } = input.data;
  try {
    const account = await prisma.user.findFirst({ where: { id: admin.id, role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
    if (!account) return fail("등록된 최고관리자 계정이 필요합니다.", 403);
    const inquiry = await prisma.supportInquiry.findUnique({ where: { id }, select: { userId: true } });
    if (!inquiry) return fail("문의를 찾을 수 없습니다.", 404);
    const updated = await prisma.supportInquiry.updateMany({
      where: { id, answeredAt: null },
      data: { reply, answeredAt: new Date() },
    });
    if (!updated.count) {
      const current = await prisma.supportInquiry.findUnique({ where: { id }, select: { reply: true } });
      if (current?.reply === reply) return ok({ id });
      return fail("다른 운영자가 이미 답변했습니다. 페이지를 새로고침해 주세요.", 409);
    }

    await Promise.all([
      audit({ actorId: admin.id, action: "SUPPORT_INQUIRY_REPLY", entity: "SupportInquiry", entityId: id }),
      notify({ userId: inquiry.userId, type: "INQUIRY", title: "고객 문의에 답변이 등록되었습니다", link: `/support/${id}` }),
    ]);
    return ok({ id });
  } catch (error) {
    console.error("Support inquiry reply failed", error instanceof Error ? error.name : "UnknownError");
    return fail("답변 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.", 503);
  }
}
