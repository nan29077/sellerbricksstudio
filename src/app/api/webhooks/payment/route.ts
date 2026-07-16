import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { getPaymentAdapter } from "@/lib/adapters/payment";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const adapter = getPaymentAdapter();
  if (!adapter.verifyWebhook(raw, signature)) return fail("서명 검증 실패", 401);

  let payload: any = {};
  try { payload = JSON.parse(raw); } catch { return fail("잘못된 페이로드"); }

  const { pgTransactionId, status } = payload;
  if (pgTransactionId) {
    const payment = await prisma.payment.findFirst({ where: { pgTransactionId } });
    if (payment) {
      await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "WEBHOOK", payload: raw } });
      if (status) await prisma.payment.update({ where: { id: payment.id }, data: { status } });
    }
  }
  return ok({ received: true });
}
