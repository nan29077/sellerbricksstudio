import { hasUnreadForUser } from "@/lib/support";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { notifyAdmins } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { SUPPORT_CATEGORIES, effectiveStatus, isOwnUpload, supportInquirySchema } from "@/lib/support";

export const dynamic = "force-dynamic";

// POST /api/support/inquiries — 1:1 문의 접수 (회원 · 비회원)
//  - 회원: 로그인 계정으로 접수, 이미지 첨부 가능, 답변은 앱 알림
//  - 비회원: 이름 · 이메일(필수) · 연락처(선택) + 개인정보 수집 동의, 답변은 이메일과 확인 링크(접수 결과에 포함)
//  - 문의하기 팝업 · 챗봇에서 오면 source · 챗봇 대화 기록 · 연 화면을 함께 남겨 운영팀이 맥락을 본다
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return fail("문의 요청 형식이 올바르지 않습니다.", 415);
  }
  const ip = clientIp(request);
  if (!(await consume(`support:${user ? `u:${user.id}` : `ip:${ip}`}`, user ? 20 : 5, 10 * MINUTE))) {
    return fail("문의 접수가 너무 잦습니다. 잠시 후 다시 시도해 주세요.", 429);
  }
  const input = supportInquirySchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(input.error.issues[0].message);
  const { id, category, subject, message, reference, attachments = [], source = "PAGE", chatTranscript, pagePath, guestName, guestEmail, guestPhone, agreePrivacy } = input.data;

  if (!user) {
    if (!guestName || !guestEmail) return fail("비회원 문의는 이름과 답변 받을 이메일을 입력해 주세요.");
    if (!agreePrivacy) return fail("개인정보 수집 · 이용에 동의해 주세요. (답변 안내 목적, 답변 후 1년 보관)");
    if (attachments.length) return fail("이미지 첨부는 로그인한 회원만 할 수 있습니다.");
  }
  if (attachments.some((a) => !isOwnUpload(a))) return fail("첨부 이미지는 스토리지마켓에 올린 이미지만 쓸 수 있습니다.");

  const guestToken = user ? null : randomBytes(24).toString("base64url");
  try {
    if (user) {
      const account = await prisma.user.findUnique({ where: { id: user.id }, select: { isActive: true } });
      if (!account?.isActive) return fail("등록된 회원 계정으로 로그인해 주세요.", 403);
    }
    await prisma.supportInquiry.create({
      data: {
        id, userId: user?.id ?? null, category, subject, message, reference: reference || null,
        guestName: user ? null : guestName, guestEmail: user ? null : guestEmail!.toLowerCase(), guestPhone: user ? null : guestPhone || null, guestToken,
        attachments, source, chatTranscript: chatTranscript?.trim() || null, pagePath: pagePath?.slice(0, 200) || null,
        priority: category === "ORDER_PAYMENT" || category === "SETTLEMENT" ? "HIGH" : "NORMAL",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.supportInquiry.findUnique({ where: { id } }).catch(() => null);
      if (existing && existing.userId === (user?.id ?? null) && existing.subject === subject && existing.message === message) {
        return ok({ id, guestToken: existing.guestToken ?? undefined }); // 같은 요청을 두 번 보낸 경우
      }
      return fail("같은 접수번호로 문의가 이미 접수되었습니다. 내 문의에서 확인해 주세요.", 409);
    }
    console.error("Support inquiry creation failed", error instanceof Error ? error.name : "UnknownError");
    return fail("문의 접수에 실패했습니다. 입력 내용을 유지한 채 다시 시도해 주세요.", 503);
  }

  await notifyAdmins({
    type: "INQUIRY", title: `새 고객 문의${user ? "" : " (비회원)"}${source === "CHATBOT" ? " · 챗봇에서 연결" : ""}`,
    body: `${SUPPORT_CATEGORIES[category].label} · ${subject}`, link: `/admin/support?q=${id}`,
  });
  return ok({ id, guestToken: guestToken ?? undefined }, 201);
}

// GET /api/support/inquiries — 내 문의 목록 (회원, 문의하기 팝업의 '내 문의')
export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("로그인 후 내 문의를 확인할 수 있어요.", 401);
  const rows = await prisma.supportInquiry.findMany({
    where: { userId: user.id }, orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }], take: 20,
    select: { id: true, subject: true, category: true, status: true, answeredAt: true, createdAt: true, updatedAt: true, lastAdminReplyAt: true, userReadAt: true, message: true, _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, author: true } } },
  }).catch(() => null);
  if (!rows) return fail("문의 내역을 불러오지 못했습니다.", 503);
  return ok(rows.map((r) => ({
    id: r.id, subject: r.subject, category: SUPPORT_CATEGORIES[r.category].label, status: effectiveStatus(r), createdAt: r.createdAt, updatedAt: r.updatedAt, messages: r._count.messages,
    unread: hasUnreadForUser(r), last: (r.messages[0]?.body ?? r.message).slice(0, 80), lastFrom: r.messages[0]?.author ?? "USER",
  })));
}
