import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { orderNo } from "@/lib/utils";
import { getPaymentAdapter, paymentBlockedReason } from "@/lib/adapters/payment";
import { audit } from "@/lib/audit";
import { getPolicy } from "@/lib/policy";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { checkLowStock, createPurchaseOrdersInTx, notifyNewPurchaseOrders, reserveOrderStockInTx, StockError } from "@/lib/purchase-orders";
import { failPendingOrder } from "@/lib/order-actions";

// 방송 상태별 주문 가능 여부 (종료 후에는 정책의 '종료 후 주문 허용 시간' 안에서만)
async function orderClosedReason(session: { status: string; endedAt: Date | null }) {
  if (session.status === "CANCELLED") return "취소된 방송입니다.";
  if (session.status !== "ENDED") return null;
  const { orderAfterEndHours } = await getPolicy();
  const endedAt = session.endedAt?.getTime() ?? 0;
  if (orderAfterEndHours > 0 && endedAt && Date.now() - endedAt < orderAfterEndHours * 3600000) return null;
  return "종료된 방송입니다. 주문이 마감되었습니다.";
}

// 구매자는 비로그인. 방송 링크 기반 주문 생성 → 결제(PG) → 결제 확정 순서로, 결제는 DB 트랜잭션 밖에서 처리한다.
// (PG 승인 후 DB 처리가 실패하면 PG 결제를 취소하고 재고를 되돌린다)
export async function POST(req: NextRequest) {
  try {
    const blocked = paymentBlockedReason();
    if (blocked) return fail(blocked, 503);

    // 같은 접속(통신사 공유 IP 고려해 넉넉하게)과 같은 연락처의 과도한 주문을 막는다.
    const ip = clientIp(req);
    if (!(await consume(`order:ip:${ip}`, 60, 10 * MINUTE))) return fail("주문 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);

    const body = await req.json();
    const data = checkoutSchema.parse(body);
    const phoneKey = data.buyerPhone.replace(/\D/g, "");
    if (!(await consume(`order:phone:${phoneKey}`, 20, 10 * MINUTE))) return fail("같은 연락처로 주문이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);

    const session = await prisma.liveSession.findUnique({ where: { slug: data.sessionSlug } });
    if (!session) return fail("방송을 찾을 수 없습니다.", 404);
    const closed = await orderClosedReason(session);
    if (closed) return fail(closed, 409);

    // 상품 검증 + 금액 계산 (서버 기준)
    const lspIds = data.items.map((i) => i.liveSessionProductId);
    const lsps = await prisma.liveSessionProduct.findMany({ where: { id: { in: lspIds }, liveSessionId: session.id, isActive: true } });
    const map = new Map(lsps.map((l) => [l.id, l]));
    if (lsps.length !== new Set(lspIds).size) return fail("판매 종료되었거나 존재하지 않는 상품이 있습니다.");

    // 같은 상품을 여러 줄로 담은 경우까지 합쳐서 재고를 확인한다.
    const qtyByProduct = new Map<string, number>();
    for (const i of data.items) qtyByProduct.set(i.liveSessionProductId, (qtyByProduct.get(i.liveSessionProductId) ?? 0) + i.quantity);
    for (const [id, qty] of Array.from(qtyByProduct)) {
      const l = map.get(id)!;
      if (qty > l.stockSnapshot) return fail(`${l.nameSnapshot}: 재고가 부족합니다. (남은 수량 ${l.stockSnapshot}개)`, 409);
    }

    // 옵션 상품은 옵션을 골라야 하고, 고른 값이 실제 옵션이어야 한다.
    for (const i of data.items) {
      const l = map.get(i.liveSessionProductId)!;
      if (!l.optionSnapshot) continue;
      let groups: { name: string; values: string[] }[] = [];
      try { groups = JSON.parse(l.optionSnapshot); } catch { groups = []; }
      if (!Array.isArray(groups) || !groups.length) continue;
      const parts = (i.optionLabel ?? "").split(" / ").map((x) => x.split(":"));
      const valid = parts.length === groups.length && groups.every((g, idx) => parts[idx]?.[0] === g.name && g.values.includes(parts[idx]?.[1] ?? ""));
      if (!valid) return fail(`${l.nameSnapshot}: 옵션을 선택해 주세요.`);
    }
    // 브랜드 직배송 상품은 구매자에게 바로 배송되므로 배송지가 필요하다.
    if (lsps.some((l) => l.fulfillment === "DROPSHIP") && (data.buyerAddress ?? "").trim().length < 5) {
      return fail("배송지를 입력하세요.");
    }

    let total = 0;
    const itemData = data.items.map((i) => {
      const l = map.get(i.liveSessionProductId)!;
      const lineTotal = l.priceSnapshot * i.quantity;
      total += lineTotal;
      return { liveSessionProductId: l.id, displayNumber: l.displayNumber, productName: l.nameSnapshot, unitPrice: l.priceSnapshot, quantity: i.quantity, optionLabel: i.optionLabel, lineTotal };
    });

    // 1) 주문 생성 + 재고 확보 (방송 재고 · 브랜드 실재고 · 창고 재고) — 하나라도 모자라면 전체 롤백
    const pending = await prisma.$transaction(async (tx) => {
      for (const [id, qty] of Array.from(qtyByProduct)) {
        const dec = await tx.liveSessionProduct.updateMany({
          where: { id, isActive: true, stockSnapshot: { gte: qty } },
          data: { stockSnapshot: { decrement: qty } },
        });
        if (dec.count !== 1) throw new StockError(`${map.get(id)!.nameSnapshot}: 방금 재고가 소진되었습니다.`);
      }
      const order = await tx.order.create({
        data: {
          orderNo: orderNo(), liveSessionId: session.id, sellerId: session.sellerId, facilityId: session.facilityId,
          buyerName: data.buyerName, buyerPhone: data.buyerPhone, buyerAddress: data.buyerAddress,
          status: "PAYMENT_PENDING", totalAmount: total, privacyAgreedAt: new Date(),
          items: { create: itemData },
        },
      });
      const brandProducts = await reserveOrderStockInTx(tx, order.id);
      await tx.liveSession.update({ where: { id: session.id }, data: { numberVersion: { increment: 1 } } });
      return { order, brandProducts };
    }, { timeout: 20000 });
    const order = pending.order;

    // 2) 결제 (트랜잭션 밖)
    const adapter = getPaymentAdapter();
    const payment = await prisma.payment.create({
      data: { orderId: order.id, provider: adapter.provider, method: data.method, status: "IN_PROGRESS", amount: total },
    });
    let pgTransactionId: string | undefined;
    try {
      const created = await adapter.createPayment({ orderId: order.id, amount: total, method: data.method, orderName: session.title, buyerName: data.buyerName, buyerPhone: data.buyerPhone });
      pgTransactionId = created.pgTransactionId;
      await prisma.payment.update({ where: { id: payment.id }, data: { pgTransactionId } });
      await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "CREATED", payload: JSON.stringify(created) } });
      if (!created.success || !pgTransactionId) throw new Error(created.failReason ?? "결제를 시작하지 못했습니다.");
      const confirmed = await adapter.confirmPayment(pgTransactionId, total);
      if (!confirmed.success) throw new Error(confirmed.failReason ?? "결제에 실패했습니다.");
      await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "CONFIRMED", payload: JSON.stringify(confirmed) } });

      // 3) 결제 확정 + 브랜드 발주서 생성
      const purchaseOrders = await prisma.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", approvedAt: confirmed.approvedAt ?? new Date() } });
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
        return createPurchaseOrdersInTx(tx, order.id);
      }, { timeout: 20000 });
      await notifyNewPurchaseOrders(purchaseOrders);
      await checkLowStock(pending.brandProducts);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "결제에 실패했습니다.";
      // PG 승인까지 됐다면 결제를 취소한다 (돈만 빠지고 주문이 없는 상황 방지)
      if (pgTransactionId) {
        const paid = await prisma.paymentEvent.findFirst({ where: { paymentId: payment.id, type: "CONFIRMED" }, select: { id: true } });
        if (paid) await adapter.cancelPayment(pgTransactionId, `주문 처리 실패: ${reason}`).catch(() => null);
      }
      await failPendingOrder(order.id, payment.id, reason);
      return fail(reason.startsWith("결제") ? reason : `결제에 실패했습니다. ${reason}`, 402);
    }

    await audit({ action: "ORDER_PAID", entity: "Order", entityId: order.id, meta: { total } });
    return ok({ orderId: order.id, orderNo: order.orderNo }, 201);
  } catch (e) {
    if (e instanceof StockError) return fail(e.message, 409);
    return handleError(e);
  }
}
