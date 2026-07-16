import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { orderNo } from "@/lib/utils";
import { getPaymentAdapter } from "@/lib/adapters/payment";
import { audit } from "@/lib/audit";

// 구매자는 비로그인. 방송 링크 기반 주문 생성 + Mock 결제.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = checkoutSchema.parse(body);

    const session = await prisma.liveSession.findUnique({ where: { slug: data.sessionSlug } });
    if (!session) return fail("방송을 찾을 수 없습니다.", 404);
    if (session.status === "CANCELLED") return fail("종료된 방송입니다.");

    // 상품 검증 + 금액 계산 (서버 기준)
    const lspIds = data.items.map((i) => i.liveSessionProductId);
    const lsps = await prisma.liveSessionProduct.findMany({ where: { id: { in: lspIds }, liveSessionId: session.id, isActive: true } });
    const map = new Map(lsps.map((l) => [l.id, l]));
    if (lsps.length !== new Set(lspIds).size) return fail("판매 종료되었거나 존재하지 않는 상품이 있습니다.");

    let total = 0;
    const itemData = data.items.map((i) => {
      const l = map.get(i.liveSessionProductId)!;
      if (i.quantity > l.stockSnapshot) throw new Error(`${l.nameSnapshot}: 재고가 부족합니다.`);
      const lineTotal = l.priceSnapshot * i.quantity;
      total += lineTotal;
      return { liveSessionProductId: l.id, displayNumber: l.displayNumber, productName: l.nameSnapshot, unitPrice: l.priceSnapshot, quantity: i.quantity, optionLabel: i.optionLabel, lineTotal };
    });

    const adapter = getPaymentAdapter();

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNo: orderNo(), liveSessionId: session.id, sellerId: session.sellerId, facilityId: session.facilityId,
          buyerName: data.buyerName, buyerPhone: data.buyerPhone, buyerAddress: data.buyerAddress,
          status: "PAYMENT_PENDING", totalAmount: total,
          items: { create: itemData },
        },
      });

      // Mock PG: create -> confirm
      const created = await adapter.createPayment({ orderId: order.id, amount: total, method: data.method, orderName: session.title, buyerName: data.buyerName, buyerPhone: data.buyerPhone });
      const payment = await tx.payment.create({
        data: { orderId: order.id, provider: adapter.provider, method: data.method, status: "IN_PROGRESS", amount: total, pgTransactionId: created.pgTransactionId },
      });
      await tx.paymentEvent.create({ data: { paymentId: payment.id, type: "CREATED", payload: JSON.stringify(created) } });

      const confirmed = await adapter.confirmPayment(created.pgTransactionId!, total);
      if (!confirmed.success) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failReason: confirmed.failReason } });
        await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
        throw new Error("결제에 실패했습니다.");
      }
      await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", approvedAt: confirmed.approvedAt } });
      await tx.paymentEvent.create({ data: { paymentId: payment.id, type: "CONFIRMED", payload: JSON.stringify(confirmed) } });
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });

      // 재고 차감
      for (const i of itemData) {
        await tx.liveSessionProduct.update({ where: { id: i.liveSessionProductId }, data: { stockSnapshot: { decrement: i.quantity } } });
      }
      return order;
    });

    await audit({ action: "ORDER_PAID", entity: "Order", entityId: result.id, meta: { total } });
    return ok({ orderId: result.id, orderNo: result.orderNo }, 201);
  } catch (e) { return handleError(e); }
}
