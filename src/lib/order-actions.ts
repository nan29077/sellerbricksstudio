import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getPolicy } from "./policy";
import { SETTLEMENT_ORDER_INCLUDE, splitOrder } from "./settlement";
import { getPaymentAdapter } from "./adapters/payment";
import { audit } from "./audit";
import { refreshOrderStatusInTx } from "./order-fulfillment";
import {
  closePurchaseOrderInTx, notifyPoPartners, notifyPurchaseOrderChanges, releaseOrderStockInTx,
  restoreOwnFacilityStockInTx, syncPurchaseOrdersWithOrder, type PoChange,
} from "./purchase-orders";

type Tx = Prisma.TransactionClient;

export const PRE_SHIP: OrderStatus[] = ["PAID", "PREPARING"];
export const POST_SHIP: OrderStatus[] = ["SHIPPED", "DELIVERED"];

// 이미 판매 정산에 들어간 주문이 환불·취소되면, 그만큼을 다음 판매 정산에서 자동 차감할 조정 항목으로 남긴다.
// includeShipping: 주문 전체가 닫힐 때만 배송비(셀러 몫)도 차감한다.
async function salesAdjustmentInTx(tx: Tx, orderId: string, itemIds: string[] | null, reason: string, includeShipping: boolean) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: SETTLEMENT_ORDER_INCLUDE });
  if (!order?.settlementId) return;
  const items = order.items.filter((i) => (itemIds ? itemIds.includes(i.id) : !i.cancelledAt));
  if (!items.length && !(includeShipping && order.shippingFee > 0)) return;
  const r = splitOrder({ shippingFee: order.shippingFee, items: items.map((i) => ({ ...i, cancelledAt: null })) }, await getPolicy(), { includeShipping });
  await tx.salesAdjustment.create({
    data: {
      sellerId: order.sellerId, facilityId: order.facilityId, orderId: order.id, reason: `${order.orderNo} ${reason}`.slice(0, 300),
      grossAmount: -r.gross, sellerAmount: -r.seller, facilityAmount: -r.facility, platformFee: -r.platformFee, brandAmount: -r.brand,
    },
  });
}

// ---------------------------------------------------------------------------
// 주문 전체 상태 변경 (주문 처리 화면 · 결제사 웹훅 공통)
//  - 취소(출고 전): 방송 재고 복구 + 발주 취소(브랜드·창고 재고 복구)
//  - 환불(출고 후): 발주 반품 처리
//  - 이미 정산된 주문·발주는 다음 정산에서 자동 차감
// ---------------------------------------------------------------------------
// expectedFrom: 화면에서 처리할 때 본 상태. 그 사이 다른 처리(중복 클릭 · 결제사 통지)로 바뀌었으면 막는다.
export async function applyOrderStatusInTx(tx: Tx, orderId: string, status: OrderStatus, note: string, actor: string, expectedFrom?: OrderStatus) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order:${orderId}`}))`;
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true, items: true } });
  if (!order) throw new Error("주문을 찾을 수 없습니다.");
  if (expectedFrom && order.status !== expectedFrom) throw new OrderActionError("다른 곳에서 이미 처리된 주문입니다. 새로고침해 주세요.", 409);
  if (order.status === status) throw new OrderActionError("이미 처리된 주문입니다.", 409);
  const closing = status === "CANCELLED" || status === "REFUNDED";
  if (closing && order.payment) {
    await tx.payment.update({ where: { id: order.payment.id }, data: { status, failReason: note } });
    await tx.paymentEvent.create({ data: { paymentId: order.payment.id, type: status, payload: JSON.stringify({ reason: note, by: actor }) } });
  }
  if (status === "CANCELLED") {
    const open = order.items.filter((i) => !i.cancelledAt);
    for (const item of open) {
      await tx.liveSessionProduct.update({ where: { id: item.liveSessionProductId }, data: { stockSnapshot: { increment: item.quantity } } });
    }
    await restoreOwnFacilityStockInTx(tx, order.id, open.map((i) => i.id));
    await tx.liveSession.update({ where: { id: order.liveSessionId }, data: { numberVersion: { increment: 1 } } });
  }
  if (closing) await salesAdjustmentInTx(tx, order.id, null, status === "CANCELLED" ? "취소 (정산 후)" : "환불 (정산 후)", true);
  const poChanges = await syncPurchaseOrdersWithOrder(tx, order.id, status, note || undefined);
  const row = await tx.order.update({
    where: { id: order.id },
    data: {
      status,
      ...(status === "DELIVERED" && { deliveredAt: new Date() }),
      ...(closing && { refundedAmount: order.totalAmount }),
    },
  });
  return { order: row, poChanges };
}

export class OrderActionError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// ---------------------------------------------------------------------------
// 부분 취소·환불 (발주서 단위 또는 주문 줄 단위)
//  - 브랜드 상품은 같은 발주서에 묶인 줄을 함께 취소한다. (발주서를 반쪽만 취소하지 않도록)
//  - 결제사에 부분 환불을 먼저 요청하고, 성공했을 때만 주문을 바꾼다.
//  - 남은 줄이 없으면 주문 전체 취소·환불로 처리한다.
// ---------------------------------------------------------------------------
export async function cancelOrderItems(params: { orderId: string; itemIds?: string[]; purchaseOrderId?: string; reason: string; actorId: string }) {
  const reason = params.reason.trim().slice(0, 300);
  if (!reason) throw new OrderActionError("취소·환불 사유를 입력하세요.");
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { payment: true, items: true, purchaseOrders: { select: { id: true, status: true, items: { select: { orderItemId: true } } } } },
  });
  if (!order) throw new OrderActionError("주문을 찾을 수 없습니다.", 404);
  if (![...PRE_SHIP, ...POST_SHIP].includes(order.status)) throw new OrderActionError("현재 주문 상태에서는 부분 취소할 수 없습니다.", 409);

  const selected = new Set<string>(params.itemIds ?? []);
  if (params.purchaseOrderId) {
    const po = order.purchaseOrders.find((p) => p.id === params.purchaseOrderId);
    if (!po) throw new OrderActionError("이 주문의 발주서가 아닙니다.", 404);
    po.items.forEach((i) => selected.add(i.orderItemId));
  }
  // 같은 발주서의 다른 줄도 함께
  const poOf = new Map<string, typeof order.purchaseOrders[number]>();
  for (const po of order.purchaseOrders) for (const i of po.items) poOf.set(i.orderItemId, po);
  for (const id of Array.from(selected)) poOf.get(id)?.items.forEach((i) => selected.add(i.orderItemId));

  if (Array.from(selected).some((id) => !order.items.some((i) => i.id === id))) throw new OrderActionError("이 주문의 상품이 아닌 항목이 포함되어 있습니다.");
  const targets = order.items.filter((i) => selected.has(i.id) && !i.cancelledAt);
  if (!targets.length) throw new OrderActionError("취소할 상품을 선택하세요. (이미 취소된 상품은 제외됩니다)");

  const remaining = order.items.filter((i) => !i.cancelledAt && !selected.has(i.id));
  const preShip = PRE_SHIP.includes(order.status) && !order.localShippedAt; // 직접 출고분이 이미 나갔으면 환불로 본다
  const amount = targets.reduce((s, i) => s + i.lineTotal, 0);

  // 남는 상품이 없으면 주문 전체 처리
  if (!remaining.length) {
    const status: OrderStatus = preShip ? "CANCELLED" : "REFUNDED";
    const refundLeft = order.totalAmount - order.refundedAmount;
    if (order.payment?.pgTransactionId && order.payment.status === "PAID" && refundLeft > 0) {
      const adapter = getPaymentAdapter();
      const res = order.refundedAmount === 0 && preShip
        ? await adapter.cancelPayment(order.payment.pgTransactionId, reason)
        : await adapter.refundPayment(order.payment.pgTransactionId, refundLeft, reason);
      if (!res.success) throw new OrderActionError(res.failReason ?? "결제사 처리에 실패했습니다. 잠시 후 다시 시도하세요.", 502);
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { cancelledAt: new Date() } });
      // 줄을 먼저 취소 표시하면 applyOrderStatusInTx 가 재고를 되돌리지 않으므로, 여기서 직접 되돌린다
      if (preShip) {
        for (const t of targets) await tx.liveSessionProduct.update({ where: { id: t.liveSessionProductId }, data: { stockSnapshot: { increment: t.quantity } } });
        await restoreOwnFacilityStockInTx(tx, order.id, targets.map((t) => t.id));
        await tx.liveSession.update({ where: { id: order.liveSessionId }, data: { numberVersion: { increment: 1 } } });
      }
      await salesAdjustmentInTx(tx, order.id, targets.map((t) => t.id), preShip ? "취소 (정산 후)" : "환불 (정산 후)", true);
      if (order.payment) {
        await tx.payment.update({ where: { id: order.payment.id }, data: { status, failReason: reason } });
        await tx.paymentEvent.create({ data: { paymentId: order.payment.id, type: status, payload: JSON.stringify({ reason, by: params.actorId, amount: refundLeft }) } });
      }
      const poChanges = await syncPurchaseOrdersWithOrder(tx, order.id, status, reason);
      await tx.order.update({ where: { id: order.id }, data: { status, refundedAmount: order.totalAmount } });
      return { poChanges, status };
    });
    await notifyPurchaseOrderChanges(result.poChanges);
    await audit({ actorId: params.actorId, action: `ORDER_${status}`, entity: "Order", entityId: order.id, meta: { reason, partial: false } });
    return { status: result.status, refunded: refundLeft, full: true };
  }

  if (order.payment?.pgTransactionId && order.payment.status === "PAID" && amount > 0) {
    const res = await getPaymentAdapter().refundPayment(order.payment.pgTransactionId, amount, reason);
    if (!res.success) throw new OrderActionError(res.failReason ?? "결제사 부분 환불에 실패했습니다. 잠시 후 다시 시도하세요.", 502);
  }
  const poChanges = await prisma.$transaction(async (tx) => {
    const ids = targets.map((t) => t.id);
    await tx.orderItem.updateMany({ where: { id: { in: ids } }, data: { cancelledAt: new Date() } });
    if (preShip) {
      for (const t of targets) await tx.liveSessionProduct.update({ where: { id: t.liveSessionProductId }, data: { stockSnapshot: { increment: t.quantity } } });
      await restoreOwnFacilityStockInTx(tx, order.id, ids);
      await tx.liveSession.update({ where: { id: order.liveSessionId }, data: { numberVersion: { increment: 1 } } });
    }
    await salesAdjustmentInTx(tx, order.id, ids, preShip ? "부분 취소 (정산 후)" : "부분 환불 (정산 후)", false);
    const changes: PoChange[] = [];
    const poIds = new Set(ids.map((id) => poOf.get(id)?.id).filter(Boolean) as string[]);
    for (const poId of Array.from(poIds)) {
      const po = order.purchaseOrders.find((p) => p.id === poId)!;
      const to = po.status === "NEW" || po.status === "CONFIRMED" ? "CANCELLED" : "RETURNED";
      const c = await closePurchaseOrderInTx(tx, poId, to, `부분 ${preShip ? "취소" : "환불"}: ${reason}`);
      if (c) changes.push(c);
    }
    if (order.payment) {
      await tx.paymentEvent.create({ data: { paymentId: order.payment.id, type: "PARTIAL_REFUND", payload: JSON.stringify({ reason, amount, items: ids, by: params.actorId }) } });
    }
    await tx.order.update({ where: { id: order.id }, data: { refundedAmount: { increment: amount } } });
    return changes;
  });
  await notifyPurchaseOrderChanges(poChanges);
  await audit({ actorId: params.actorId, action: "ORDER_PARTIAL_CANCEL", entity: "Order", entityId: order.id, meta: { reason, amount, items: targets.length, preShip } });
  return { status: order.status, refunded: amount, full: false };
}

// ---------------------------------------------------------------------------
// 직접 출고분(창고(스튜디오) 상품 · 위탁 상품 · 임시 상품) 출고 · 배송 완료
//  - 출고할 때 택배사 · 운송장을 남긴다. 창고 위탁 발주서도 함께 따라간다.
//  - 브랜드 직배송분까지 모두 출고 · 배송 완료되면 주문 전체 상태가 바뀐다.
// ---------------------------------------------------------------------------
export async function shipLocalPartInTx(tx: Tx, orderId: string, to: "SHIPPED" | "DELIVERED", info: { carrier?: string; trackingNumber?: string } = {}) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order:${orderId}`}))`;
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, localShippedAt: true, localDeliveredAt: true } });
  if (!order) throw new OrderActionError("주문을 찾을 수 없습니다.", 404);
  if (!["PAID", "PREPARING", "SHIPPED"].includes(order.status)) throw new OrderActionError("현재 주문 상태에서는 배송 처리를 할 수 없습니다.", 409);
  const now = new Date();
  if (to === "SHIPPED") {
    if (order.localShippedAt) throw new OrderActionError("이미 출고 처리된 주문입니다. 새로고침해 주세요.", 409);
    await tx.order.update({ where: { id: order.id }, data: { localShippedAt: now, shipCarrier: info.carrier?.slice(0, 30) || null, shipTrackingNumber: info.trackingNumber?.slice(0, 100) || null } });
  } else {
    if (!order.localShippedAt) throw new OrderActionError("먼저 출고(발송) 처리해 주세요.", 409);
    if (order.localDeliveredAt) throw new OrderActionError("이미 배송 완료된 주문입니다. 새로고침해 주세요.", 409);
    await tx.order.update({ where: { id: order.id }, data: { localDeliveredAt: now } });
  }
  const poChanges = await syncPurchaseOrdersWithOrder(tx, order.id, to);
  const next = await refreshOrderStatusInTx(tx, order.id);
  return { poChanges, next };
}

// 결제 실패·확정 실패 시: 확보한 재고를 돌려놓고 주문을 닫는다.
export async function failPendingOrder(orderId: string, paymentId: string | null, reason: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order || order.status !== "PAYMENT_PENDING") return;
    await releaseOrderStockInTx(tx, orderId, { liveStock: true });
    if (paymentId) {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failReason: reason.slice(0, 300) } });
      await tx.paymentEvent.create({ data: { paymentId, type: "FAILED", payload: JSON.stringify({ reason }) } });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  });
}

// 결제 대기에서 멈춘 주문 정리: 결제 확정 전에 서버가 멈추거나 구매자가 결제창을 닫으면 재고가 묶인 채 남는다.
// 30분이 지난 결제 대기 주문은 (PG 승인 기록이 있으면 결제를 취소하고) 재고를 되돌린 뒤 닫는다.
let lastCleanup = 0;
export async function cleanupStalePendingOrders(opts: { force?: boolean; olderThanMinutes?: number } = {}) {
  const now = Date.now();
  if (!opts.force && now - lastCleanup < 60_000) return 0;
  lastCleanup = now;
  const before = new Date(now - (opts.olderThanMinutes ?? 30) * 60000);
  const stale = await prisma.order.findMany({
    where: { status: "PAYMENT_PENDING", createdAt: { lt: before } },
    select: { id: true, payment: { select: { id: true, pgTransactionId: true, events: { where: { type: "CONFIRMED" }, select: { id: true }, take: 1 } } } },
    take: 100,
  }).catch(() => []);
  let closed = 0;
  for (const o of stale) {
    try {
      if (o.payment?.pgTransactionId && o.payment.events.length) {
        await getPaymentAdapter().cancelPayment(o.payment.pgTransactionId, "결제 확정 지연으로 자동 취소").catch(() => null);
      }
      await failPendingOrder(o.id, o.payment?.id ?? null, "결제가 30분 안에 완료되지 않아 자동 취소되었습니다.");
      closed += 1;
    } catch (e) { console.error("stale order cleanup failed", o.id, e); }
  }
  if (closed) await audit({ action: "ORDER_STALE_CLEANUP", entity: "Order", meta: { closed } });
  return closed;
}

export { notifyPoPartners };
