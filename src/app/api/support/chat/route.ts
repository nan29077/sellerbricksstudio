import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { answer, type BotReply } from "@/lib/support-bot";
import { BOOKING_STATUS, ORDER_STATUS } from "@/lib/status";
import { SUPPORT_STATUS, effectiveStatus } from "@/lib/support";
import { displayState } from "@/lib/booking-brand-items-view";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
const schema = z.object({ message: z.string().trim().min(1, "질문을 입력해 주세요.").max(500, "질문은 500자까지 입력할 수 있어요.") });

// POST /api/support/chat — 상담 챗봇 답변. 로그인한 회원은 내 예약 · 주문서 · 문의 상태도 바로 알려 준다.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!(await consume(`support-chat:${user?.id ?? clientIp(req)}`, 60, 10 * MINUTE))) return fail("질문이 너무 많아요. 잠시 후 다시 시도해 주세요.", 429);
  const input = schema.safeParse(await req.json().catch(() => null));
  if (!input.success) return fail(input.error.issues[0].message);
  const reply: BotReply = answer(input.data.message, user?.role);
  if (reply.personal) {
    if (!user) return ok({ ...reply, text: "로그인하면 내 예약 · 주문서 · 문의 상태를 바로 알려 드릴게요.", links: [{ label: "로그인", href: "/login" }], personal: undefined });
    try { Object.assign(reply, await personal(reply.personal, user.id, user.role)); }
    catch { reply.text = "지금은 내 정보를 불러오지 못했어요. 잠시 후 다시 물어봐 주세요."; }
    reply.personal = undefined;
  }
  return ok(reply);
}

async function personal(kind: NonNullable<BotReply["personal"]>, userId: string, role: string): Promise<Partial<BotReply>> {
  if (kind === "MY_BOOKINGS") {
    if (role !== "SELLER") return { text: "예약은 셀러 계정에서 확인할 수 있어요." };
    const list = await prisma.booking.findMany({
      where: { sellerId: userId, status: { in: ["PENDING", "APPROVED"] }, endAt: { gte: new Date() } }, orderBy: { startAt: "asc" }, take: 3,
      select: { code: true, status: true, startAt: true, facility: { select: { name: true } }, brandItems: { select: { brandRequest: { select: { status: true } } } } },
    });
    if (!list.length) return { text: "다가오는 예약이 없어요. 방송할 공간을 예약해 볼까요?", links: [{ label: "방송 공간 예약하기", href: "/seller/bookings/new" }] };
    const lines = list.map((b) => {
      const ready = b.brandItems.filter((i) => displayState(i.brandRequest?.status).key === "ARRIVED").length;
      return `• ${formatDateTime(b.startAt)} ${b.facility.name} — ${BOOKING_STATUS[b.status]?.label ?? b.status}${b.brandItems.length ? ` · 시연품 도착 ${ready}/${b.brandItems.length}` : ""}${b.code ? ` (${b.code})` : ""}`;
    });
    return { text: `다가오는 예약 ${list.length}건이에요.\n${lines.join("\n")}`, links: [{ label: "예약 관리", href: "/seller/bookings" }] };
  }
  if (kind === "MY_SHEETS") {
    if (role !== "SELLER") return { text: "주문서는 셀러 계정에서 확인할 수 있어요." };
    const [groups, last] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where: { sellerId: userId, source: "SHEET", status: { in: ["PAID", "PREPARING", "SHIPPED"] } }, _count: { id: true } }),
      prisma.order.findFirst({ where: { sellerId: userId, source: "SHEET", status: { not: "PAYMENT_PENDING" } }, orderBy: { createdAt: "desc" }, select: { orderNo: true, status: true, buyerName: true, createdAt: true } }),
    ]);
    const count = (s: string) => groups.find((g) => g.status === s)?._count.id ?? 0;
    return {
      text: `출고 준비 ${count("PAID") + count("PREPARING")}건 · 배송 중 ${count("SHIPPED")}건이에요.${last ? `\n최근 주문서: ${last.orderNo} (${last.buyerName}) — ${ORDER_STATUS[last.status]?.label ?? last.status}` : ""}`,
      links: [{ label: "주문서 · 배송 현황", href: "/seller/orders" }, { label: "주문서 작성", href: "/seller/orders/new" }],
    };
  }
  const list = await prisma.supportInquiry.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 3, select: { id: true, subject: true, status: true, answeredAt: true } });
  if (!list.length) return { text: "아직 남긴 문의가 없어요." };
  return {
    text: `최근 문의 ${list.length}건이에요.\n${list.map((i) => `• ${i.subject} — ${SUPPORT_STATUS[effectiveStatus(i)].label}`).join("\n")}`,
    links: list.slice(0, 2).map((i) => ({ label: i.subject.slice(0, 18), href: `/support/${i.id}` })),
  };
}
