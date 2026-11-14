import { getSessionUser } from "@/lib/auth";
import { ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/support/context — 문의하기 팝업에서 '관련 번호'로 고를 수 있는 내 최근 예약 · 주문서 (회원)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return ok({ member: false, refs: [] });
  const [bookings, orders] = await Promise.all([
    user.role === "SELLER" ? prisma.booking.findMany({ where: { sellerId: user.id }, orderBy: { startAt: "desc" }, take: 5, select: { code: true, startAt: true, facility: { select: { name: true } } } }).catch(() => []) : Promise.resolve([]),
    user.role === "SELLER" ? prisma.order.findMany({ where: { sellerId: user.id, source: "SHEET" }, orderBy: { createdAt: "desc" }, take: 5, select: { orderNo: true, buyerName: true, createdAt: true } }).catch(() => []) : Promise.resolve([]),
  ]);
  return ok({
    member: true, name: user.name ?? null, email: user.email,
    refs: [
      ...bookings.filter((b) => b.code).map((b) => ({ value: b.code!, label: `예약 ${b.code} · ${b.facility.name} · ${formatDateTime(b.startAt)}` })),
      ...orders.map((o) => ({ value: o.orderNo, label: `주문서 ${o.orderNo} · ${o.buyerName}` })),
    ],
  });
}
