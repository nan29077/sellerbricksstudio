import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getPaymentAdapter } from "@/lib/adapters/payment";
import { notifyPurchaseOrderChanges } from "@/lib/purchase-orders";
import { applyOrderStatusInTx, cancelOrderItems, OrderActionError, shipLocalPartInTx } from "@/lib/order-actions";
import { FULFILLMENT_ITEM_SELECT, orderActions, orderParts } from "@/lib/order-fulfillment";
import { clearLimit, consume } from "@/lib/rate-limit";
import { notifyBuyer } from "@/lib/order-notify";
import { canOperateFacility } from "@/lib/facility-owner";

const REFUND_DENIED = "출고된 주문의 환불은 상품을 출고한 창고(스튜디오) 또는 최고관리자만 할 수 있습니다. 브랜드가 보낸 상품의 환불은 고객지원 1:1 문의로 요청해 주세요.";

// PATCH /api/orders/[id]
//  body: { status, reason?, carrier?, trackingNumber? }
//    - 준비중 · 발송(운송장) · 배송완료: 직접 출고분의 배송 담당만 (창고(스튜디오) 방송 → 창고, 셀러 공간 방송의 임시 상품 → 셀러)
//      브랜드 직배송분은 브랜드가 발주서에서 처리하고, 모두 끝나면 주문 상태가 자동으로 바뀐다.
//    - 취소(출고 전): 셀러 · 주문 운영자(창고 방송은 창고, 셀러 공간 방송은 셀러) · 최고관리자
//    - 환불(출고 후): 주문 운영자 · 최고관리자
//  body: { action: "cancel-items", itemIds?, purchaseOrderId?, reason } — 부분 취소(출고 전) · 부분 환불(출고 후)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { status?: OrderStatus; reason?: string; action?: string; itemIds?: unknown; purchaseOrderId?: unknown; carrier?: unknown; trackingNumber?: unknown };

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        facility: { select: { id: true, name: true } }, payment: true,
        items: { select: FULFILLMENT_ITEM_SELECT },
        purchaseOrders: { select: { status: true, fulfillment: true } },
      },
    });
    if (!order) return fail("주문을 찾을 수 없습니다.", 404);

    const actor = { isAdmin: user.role === "SUPER_ADMIN", isSeller: order.sellerId === user.id, isFacilityOwner: !!order.facility && user.role !== "SUPER_ADMIN" && (await canOperateFacility(user, order.facility.id)) };
    if (!actor.isAdmin && !actor.isSeller && !actor.isFacilityOwner) return fail("이 주문을 처리할 권한이 없습니다.", 403);
    const can = orderActions(order, actor);

    // 같은 주문을 동시에 처리하지 못하게 잠근다 (취소 버튼 연타 · 셀러와 창고가 동시에 처리 → 결제 취소 두 번 방지)
    const lockKey = `order-action:${order.id}`;
    if (!(await consume(lockKey, 1, 30_000))) return fail("이 주문을 다른 곳에서 처리하고 있습니다. 잠시 후 새로고침해 주세요.", 409);
    try {
      if (body.action === "cancel-items") {
        const preShip = !orderParts(order).anyShipped && (order.status === "PAID" || order.status === "PREPARING");
        if (preShip ? !can.canCancel : !can.canRefund) {
          return fail(preShip ? "이 주문을 취소할 권한이 없습니다." : REFUND_DENIED, 403);
        }
        const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter((v): v is string => typeof v === "string").slice(0, 200) : undefined;
        const purchaseOrderId = typeof body.purchaseOrderId === "string" ? body.purchaseOrderId : undefined;
        if (!itemIds?.length && !purchaseOrderId) return fail("취소할 상품이나 발주서를 선택하세요.");
        const result = await cancelOrderItems({ orderId: order.id, itemIds, purchaseOrderId, reason: String(body.reason ?? ""), actorId: user.id });
        return ok(result);
      }

      const status = body.status;
      if (!status || !(can.statuses as string[]).includes(status)) {
        if (status && ["PREPARING", "SHIPPED", "DELIVERED"].includes(status) && !can.isShipper) {
          return fail(can.localShipper === null
            ? "브랜드 직배송 상품은 브랜드가 발주서에서 출고 · 배송 완료를 처리합니다. 여기서는 배송 상태를 확인만 할 수 있습니다."
            : can.localShipper === "FACILITY" ? "배송 상태는 상품을 출고하는 창고(스튜디오)가 바꿉니다. 셀러는 확인만 할 수 있습니다." : "배송 상태는 셀러가 바꿉니다.", 403);
        }
        if (status === "REFUNDED" && !can.canRefund) return fail(REFUND_DENIED, 403);
        return fail("현재 주문 상태에서는 이 처리를 할 수 없습니다.", 409);
      }
      const note = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
      if ((status === "CANCELLED" || status === "REFUNDED") && !note) {
        return fail(status === "CANCELLED" ? "취소 사유를 입력하세요." : "환불 사유를 입력하세요.");
      }

      // 직접 출고분 발송 · 배송 완료 (운송장 필수)
      if (status === "SHIPPED" || status === "DELIVERED") {
        const carrier = typeof body.carrier === "string" ? body.carrier.trim() : "";
        const trackingNumber = typeof body.trackingNumber === "string" ? body.trackingNumber.trim() : "";
        if (status === "SHIPPED" && (!carrier || !trackingNumber)) return fail("택배사와 운송장 번호를 입력하세요.");
        const r = await prisma.$transaction((tx) => shipLocalPartInTx(tx, order.id, status, { carrier, trackingNumber }));
        await notifyPurchaseOrderChanges(r.poChanges);
        await audit({ actorId: user.id, action: `ORDER_LOCAL_${status}`, entity: "Order", entityId: order.id, meta: { carrier, trackingNumber, orderStatus: r.next } });
        // 셀러에게 배송 진행 알림 (셀러가 직접 처리한 경우 제외)
        if (!actor.isSeller) {
          await notify({
            userId: order.sellerId, type: "ORDER",
            title: status === "SHIPPED" ? `주문 ${order.orderNo} 출고` : `주문 ${order.orderNo} 배송 완료`,
            body: `${order.facility?.name ?? ""}${status === "SHIPPED" ? ` · ${carrier} ${trackingNumber}` : ""}`, link: "/seller/orders",
          });
        }
        if (status === "SHIPPED") await notifyBuyer(order.id, { kind: "SHIPPED", carrier, trackingNumber, from: order.facility?.name });
        const fresh = await prisma.order.findUnique({ where: { id: order.id }, select: { id: true, status: true } });
        return ok({ id: order.id, status: fresh?.status ?? order.status, localStatus: status });
      }

      // 취소·환불은 PG에 먼저 요청하고, 성공했을 때만 주문을 바꾼다. (부분 환불이 있었다면 남은 금액만)
      if ((status === "CANCELLED" || status === "REFUNDED") && order.payment?.pgTransactionId && order.payment.status === "PAID") {
        const adapter = getPaymentAdapter();
        const left = order.totalAmount - order.refundedAmount;
        const result = status === "CANCELLED" && order.refundedAmount === 0
          ? await adapter.cancelPayment(order.payment.pgTransactionId, note)
          : await adapter.refundPayment(order.payment.pgTransactionId, left, note);
        if (!result.success) return fail(result.failReason ?? "결제사 처리에 실패했습니다. 잠시 후 다시 시도하세요.", 502);
      }

      const updated = await prisma.$transaction((tx) => applyOrderStatusInTx(tx, order.id, status, note, user.id, order.status));
      await notifyPurchaseOrderChanges(updated.poChanges);
      await audit({
        actorId: user.id, action: `ORDER_${status}`, entity: "Order", entityId: order.id,
        meta: { from: order.status, to: status, reason: note || undefined },
      });
      if ((status === "CANCELLED" || status === "REFUNDED") && !actor.isSeller) {
        await notify({ userId: order.sellerId, type: "ORDER", title: `주문 ${order.orderNo} ${status === "CANCELLED" ? "취소" : "환불"}`, body: note, link: "/seller/orders" });
      }
      if (status === "CANCELLED" || status === "REFUNDED") {
        await notifyBuyer(order.id, { kind: status, amount: order.totalAmount - order.refundedAmount, reason: note });
      }
      return ok({ id: updated.order.id, status: updated.order.status });
    } finally {
      await clearLimit(lockKey);
    }
  } catch (e) {
    if (e instanceof OrderActionError) return fail(e.message, e.status);
    return handleError(e);
  }
}
