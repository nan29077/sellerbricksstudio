import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { orderNo, shippingFeeFor } from "@/lib/utils";
import { getPaymentAdapter, paymentBlockedReason } from "@/lib/adapters/payment";
import { audit } from "@/lib/audit";
import { getPolicy } from "@/lib/policy";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { checkLowStock, createPurchaseOrdersInTx, notifyNewPurchaseOrders, reserveOrderStockInTx, StockError } from "@/lib/purchase-orders";
import { cleanupStalePendingOrders, failPendingOrder } from "@/lib/order-actions";
import { endOverdueLiveSessions } from "@/lib/live-automation";
import { lineInputOf, splitLine } from "@/lib/settlement";
import { notifyBuyer, notifyNewOrder } from "@/lib/order-notify";
import { allocateDiscount, couponBlockedReason, couponDiscount, findCoupon, normalizeCouponCode, claimCouponInTx } from "@/lib/coupons";
import { Prisma } from "@prisma/client";

// 방송 상태별 주문 가능 여부: 방송 중에만 주문을 받는다. (종료 후에는 정책의 '종료 후 주문 허용 시간' 안에서만)
async function orderClosedReason(session: { status: string; endedAt: Date | null }) {
  if (session.status === "CANCELLED") return "취소된 방송입니다.";
  if (session.status === "DRAFT" || session.status === "READY") return "방송 시작 전입니다. 방송이 시작되면 주문할 수 있습니다.";
  if (session.status !== "ENDED") return null;
  const { orderAfterEndHours } = await getPolicy();
  const endedAt = session.endedAt?.getTime() ?? 0;
  if (orderAfterEndHours > 0 && endedAt && Date.now() - endedAt < orderAfterEndHours * 3600000) return null;
  return "종료된 방송입니다. 주문이 마감되었습니다.";
}

class OrderNoClash extends Error { constructor() { super("주문번호 생성이 겹쳤습니다. 다시 시도해 주세요."); } }

// 구매자는 비로그인. 방송 링크 기반 주문 생성 → 결제(PG) → 결제 확정 순서로, 결제는 DB 트랜잭션 밖에서 처리한다.
// (PG 승인 후 DB 처리가 실패하면 PG 결제를 취소하고 재고를 되돌린다)
export async function POST(req: NextRequest) {
  try {
    const blocked = paymentBlockedReason();
    if (blocked) return fail(blocked, 503);
    await cleanupStalePendingOrders().catch(() => 0); // 1분에 한 번만 실제로 돈다
    await endOverdueLiveSessions(); // 예정 시간이 지난 방송은 먼저 종료 처리 (1분에 한 번)

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
    const lsps = await prisma.liveSessionProduct.findMany({
      where: { id: { in: lspIds }, liveSessionId: session.id, isActive: true },
      include: { facilityProduct: { select: { commissionType: true, commissionValue: true, brandProductId: true } } },
    });
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
    // 모든 상품은 택배로 배송되므로 배송지가 필요하다. (브랜드 직배송 · 창고 출고 모두)
    if ((data.buyerAddress ?? "").trim().length < 5) return fail("배송지를 입력하세요.");

    // 금액과 수익 분배는 주문하는 지금 기준으로 확정해 줄마다 저장한다. (이후 수수료·공급가가 바뀌어도 그대로)
    const policy = await getPolicy();
    let subtotal = 0;
    const itemData = data.items.map((i) => {
      const l = map.get(i.liveSessionProductId)!;
      const lineTotal = l.priceSnapshot * i.quantity;
      subtotal += lineTotal;
      const split = splitLine(lineInputOf(l, { lineTotal, unitPrice: l.priceSnapshot, quantity: i.quantity }, { ownSpace: !session.facilityId }), policy);
      return {
        liveSessionProductId: l.id, displayNumber: l.displayNumber, productName: l.nameSnapshot, unitPrice: l.priceSnapshot, quantity: i.quantity, optionLabel: i.optionLabel, lineTotal,
        platformFee: split.platformFee, brandAmount: split.brand, facilityAmount: split.facility, sellerAmount: split.seller, discountAmount: 0,
      };
    });
    const shippingFee = shippingFeeFor(session, subtotal);

    // 셀러 쿠폰: 할인은 셀러 몫에서만 뺀다 (줄마다 셀러 몫에 비례해 나눔)
    const couponCode = normalizeCouponCode(data.couponCode);
    let coupon: Awaited<ReturnType<typeof findCoupon>> = null;
    let discount = 0;
    if (couponCode) {
      coupon = await findCoupon(couponCode);
      const blockedCoupon = couponBlockedReason(coupon, session.sellerId, subtotal);
      if (blockedCoupon) return fail(blockedCoupon, 409);
      discount = couponDiscount(coupon!, subtotal, itemData.reduce((s, i) => s + i.sellerAmount, 0));
      if (discount <= 0) return fail("이 주문에는 쿠폰 할인을 적용할 수 없습니다.", 409);
      const shares = allocateDiscount(discount, itemData.map((i) => i.sellerAmount));
      itemData.forEach((it, idx) => { it.discountAmount = shares[idx]; it.sellerAmount -= shares[idx]; });
    }
    const total = subtotal - discount + shippingFee;

    // 1) 주문 생성 + 재고 확보 (방송 재고 · 브랜드 실재고 · 창고 재고) — 하나라도 모자라면 전체 롤백
    const reserve = () => prisma.$transaction(async (tx) => {
      for (const [id, qty] of Array.from(qtyByProduct)) {
        const dec = await tx.liveSessionProduct.updateMany({
          where: { id, isActive: true, stockSnapshot: { gte: qty } },
          data: { stockSnapshot: { decrement: qty } },
        });
        if (dec.count !== 1) throw new StockError(`${map.get(id)!.nameSnapshot}: 방금 재고가 소진되었습니다.`);
      }
      if (coupon && !(await claimCouponInTx(tx, coupon.id))) throw new StockError("방금 모두 사용된 쿠폰입니다. 쿠폰을 빼고 다시 결제해 주세요.");
      let order;
      try {
          order = await tx.order.create({
            data: {
              orderNo: orderNo(), liveSessionId: session.id, sellerId: session.sellerId, facilityId: session.facilityId,
              buyerName: data.buyerName, buyerPhone: data.buyerPhone, buyerAddress: data.buyerAddress,
              status: "PAYMENT_PENDING", totalAmount: total, shippingFee, privacyAgreedAt: new Date(),
              discountAmount: discount, couponId: coupon?.id ?? null, couponCode: coupon?.code ?? null,
              items: { create: itemData },
            },
          });
      } catch (e) {
        // 주문번호가 겹치면 트랜잭션을 처음부터 다시 실행한다 (아래 재시도)
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target ?? "").includes("orderNo")) throw new OrderNoClash();
        throw e;
      }
      const brandProducts = await reserveOrderStockInTx(tx, order.id);
      await tx.liveSession.update({ where: { id: session.id }, data: { numberVersion: { increment: 1 } } });
      return { order, brandProducts };
    }, { timeout: 20000 });
    let pending: Awaited<ReturnType<typeof reserve>> | null = null;
    for (let attempt = 0; attempt < 3 && !pending; attempt++) {
      try { pending = await reserve(); } catch (e) { if (!(e instanceof OrderNoClash) || attempt === 2) throw e; }
    }
    if (!pending) throw new OrderNoClash();
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
    await notifyNewOrder(order.id);
    await notifyBuyer(order.id, { kind: "PAID" });
    return ok({ orderId: order.id, orderNo: order.orderNo }, 201);
  } catch (e) {
    if (e instanceof StockError || e instanceof OrderNoClash) return fail(e.message, 409);
    return handleError(e);
  }
}
