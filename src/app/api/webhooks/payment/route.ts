import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { getPaymentAdapter } from "@/lib/adapters/payment";
import { notifyPurchaseOrderChanges } from "@/lib/purchase-orders";
import { applyOrderStatusInTx, PRE_SHIP, POST_SHIP } from "@/lib/order-actions";

const PAYMENT_STATUSES = new Set<string>(Object.values(PaymentStatus));

// PG 웹훅: 헤더 x-webhook-signature 에 본문의 HMAC-SHA256(hex) 서명이 있어야 한다.
//  - 같은 통지(eventId 또는 본문)가 다시 와도 한 번만 반영한다.
//  - 취소·환불 통지는 주문 화면의 취소·환불과 같은 처리(재고 복구 · 발주 취소/반품 · 정산 후 차감)를 한다.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const adapter = getPaymentAdapter();
  if (!adapter.verifyWebhook(raw, signature)) return fail("서명 검증 실패", 401);

  let payload: { pgTransactionId?: unknown; status?: unknown; eventId?: unknown } = {};
  try { payload = JSON.parse(raw); } catch { return fail("잘못된 페이로드"); }

  const pgTransactionId = typeof payload.pgTransactionId === "string" ? payload.pgTransactionId : null;
  const status = typeof payload.status === "string" && PAYMENT_STATUSES.has(payload.status) ? (payload.status as PaymentStatus) : null;
  if (payload.status != null && !status) return fail("알 수 없는 결제 상태입니다.");
  if (!pgTransactionId) return ok({ received: true });

  const payment = await prisma.payment.findFirst({ where: { pgTransactionId }, include: { order: { select: { id: true, status: true } } } });
  if (!payment) return ok({ received: true });

  const eventKey = `wh:${typeof payload.eventId === "string" && payload.eventId ? payload.eventId.slice(0, 120) : createHash("sha256").update(raw).digest("hex")}`;
  try {
    await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "WEBHOOK", payload: raw, eventKey } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return ok({ received: true, duplicate: true });
    throw e;
  }

  if (!status || status === payment.status) return ok({ received: true });

  if (status === "CANCELLED" || status === "REFUNDED") {
    const current = payment.order.status;
    const next = PRE_SHIP.includes(current) ? "CANCELLED" : POST_SHIP.includes(current) ? "REFUNDED" : null;
    if (next) {
      const result = await prisma.$transaction((tx) => applyOrderStatusInTx(tx, payment.order.id, next, "결제사 취소·환불 통지", "webhook"));
      await notifyPurchaseOrderChanges(result.poChanges);
      await prisma.payment.update({ where: { id: payment.id }, data: { status } });
      return ok({ received: true, order: next });
    }
  }
  await prisma.payment.update({ where: { id: payment.id }, data: { status } });
  return ok({ received: true });
}
