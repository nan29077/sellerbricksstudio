import { NextRequest } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { getPaymentAdapter } from "@/lib/adapters/payment";

const PAYMENT_STATUSES = new Set<string>(Object.values(PaymentStatus));

// PG 웹훅: 헤더 x-webhook-signature 에 본문의 HMAC-SHA256(hex) 서명이 있어야 한다.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const adapter = getPaymentAdapter();
  if (!adapter.verifyWebhook(raw, signature)) return fail("서명 검증 실패", 401);

  let payload: { pgTransactionId?: unknown; status?: unknown } = {};
  try { payload = JSON.parse(raw); } catch { return fail("잘못된 페이로드"); }

  const pgTransactionId = typeof payload.pgTransactionId === "string" ? payload.pgTransactionId : null;
  const status = typeof payload.status === "string" && PAYMENT_STATUSES.has(payload.status) ? (payload.status as PaymentStatus) : null;
  if (payload.status != null && !status) return fail("알 수 없는 결제 상태입니다.");

  if (pgTransactionId) {
    const payment = await prisma.payment.findFirst({ where: { pgTransactionId } });
    if (payment) {
      await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "WEBHOOK", payload: raw } });
      if (status && status !== payment.status) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status } });
        // 결제 취소·환불 통지는 주문 상태에도 반영한다.
        if (status === "CANCELLED" || status === "REFUNDED") {
          await prisma.order.update({ where: { id: payment.orderId }, data: { status: status === "REFUNDED" ? "REFUNDED" : "CANCELLED" } });
        }
      }
    }
  }
  return ok({ received: true });
}
