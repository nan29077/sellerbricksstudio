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
    if (session.status === "CANCELLED") return fail("취소된 방송입니다.");

    // 상품 검증 + 금액 계산 (서버 기준)
    const lspIds = data.items.map((i) => i.liveSessionProductId);
    const lsps = await prisma.liveSessionProduct.findMany({ where: { id: { in: lspIds }, liveSessionId: session.id, isActive: true } });
    const map = new Map(lsps.map((l) => [l.id, l]));
    if (lsps.length !== new Set(lspIds).size) return fail("판매 종료되었거나 존재하지 않는 상품이 있습니다.");

    // 같은 상품을 여러 줄로 담은 경우까지 합쳐서 재고를 확인한다.
    const qtyByProduct = new Map<string, number>();
    for (const i of data.items) qtyByProduct.set(i.liveSessionProductId, (qtyByProduct.get(i.liveSessionProductId) ?? 0) + i.quantity);
    for (const [id, qty] of qtyByProduct) {
      const l = map.get(id)!;
      if (qty > l.stockSnapshot) return fail(`${l.nameSnapshot}: 재고가 부족합니다. (남은 수량 ${l.stockSnapshot}개)`, 409);
    }

    let total = 0;
    const itemData = data.items.map((i) => {
      const l = map.get(i.liveSessionProductId)!;
      const lineTotal = l.priceSnapshot * i.quantity;
      total += lineTotal;
      return { liveSessionProductId: l.id, displayNumber: l.displayNumber, productName: l.nameSnapshot, unitPrice: l.priceSnapshot, quantity: i.quantity, optionLabel: i.optionLabel, lineTotal };
    });

    const adapter = getPaymentAdapter();

    const result = await prisma.$transaction(async (tx) => {
      // 재고를 조건부로 먼저 차감한다. 동시에 들어온 주문이 재고를 넘기면 여기서 막혀 전체가 롤백된다.
      for (const [id, qty] of qtyByProduct) {
        const dec = await tx.liveSessionProduct.updateMany({
          where: { id, isActive: true, stockSnapshot: { gte: qty } },
          data: { stockSnapshot: { decrement: qty } },
        });
        if (dec.count !== 1) throw new Error(`${map.get(id)!.nameSnapshot}: 방금 재고가 소진되었습니다.`);
      }

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
      return order;
    });

    await audit({ action: "ORDER_PAID", entity: "Order", entityId: result.id, meta: { total } });
    return ok({ orderId: result.id, orderNo: result.orderNo }, 201);
  } catch (e) { return handleError(e); }
}
