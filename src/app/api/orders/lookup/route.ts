import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";

// 구매자 비회원 주문 조회: 주문번호 + 주문 시 입력한 연락처가 모두 맞아야 한다.
// 연락처 대입을 막기 위해 IP당 10분에 20회로 제한한다 (서버 인스턴스 메모리 기준).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 20;
const tries = new Map<string, { count: number; first: number }>();

const digits = (v: string) => v.replace(/\D/g, "");

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";
  const now = Date.now();
  const entry = tries.get(ip);
  if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_TRIES) {
    return fail("조회 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  }
  if (!entry || now - entry.first >= WINDOW_MS) tries.set(ip, { count: 1, first: now });
  else entry.count += 1;

  const body = await req.json().catch(() => ({}));
  const orderNo = typeof body.orderNo === "string" ? body.orderNo.trim().toUpperCase() : "";
  const phone = typeof body.phone === "string" ? digits(body.phone) : "";
  if (!orderNo || phone.length < 8) return fail("주문번호와 연락처를 정확히 입력하세요.");

  const order = await prisma.order.findUnique({ where: { orderNo }, select: { id: true, buyerPhone: true } }).catch(() => null);
  // 주문이 없을 때와 연락처가 틀릴 때 같은 문구를 보여 주문번호 존재 여부를 노출하지 않는다.
  if (!order || digits(order.buyerPhone) !== phone) return fail("일치하는 주문을 찾을 수 없습니다.", 404);
  return ok({ orderId: order.id });
}
