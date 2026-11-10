import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { notifyAdmins } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { SUPPORT_CATEGORIES, supportInquirySchema } from "@/lib/support";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("로그인 후 문의를 접수해 주세요.", 401);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return fail("문의 요청 형식이 올바르지 않습니다.", 415);
  }
  const input = supportInquirySchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(input.error.issues[0].message);

  const { id, category, subject, message, reference } = input.data;
  try {
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { isActive: true } });
    if (!account?.isActive) return fail("등록된 회원 계정으로 로그인해 주세요.", 403);
    await prisma.supportInquiry.create({ data: { id, userId: user.id, category, subject, message, reference: reference || null } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.supportInquiry.findUnique({ where: { id } }).catch(() => null);
      if (existing?.userId === user.id && existing.category === category && existing.subject === subject &&
          existing.message === message && existing.reference === (reference || null)) return ok({ id });
      return fail("같은 접수번호로 문의가 이미 접수되었습니다. 내 문의에서 확인해 주세요.", 409);
    }
    console.error("Support inquiry creation failed", error instanceof Error ? error.name : "UnknownError");
    return fail("문의 접수에 실패했습니다. 입력 내용을 유지한 채 다시 시도해 주세요.", 503);
  }

  await notifyAdmins({ type: "INQUIRY", title: "새 고객 문의가 도착했습니다", body: SUPPORT_CATEGORIES[category].label, link: `/admin/support?q=${id}` });
  return ok({ id }, 201);
}
