import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { getPaymentAdapter } from "@/lib/adapters/payment";
import { ORDER_NEXT_STATUS } from "@/lib/status";
import { notifyPurchaseOrderChanges } from "@/lib/purchase-orders";
import { applyOrderStatusInTx, cancelOrderItems, OrderActionError } from "@/lib/order-actions";

// PATCH /api/orders/[id]
//  body: { status, reason? }  — 결제완료 → 준비중 → 배송중 → 배송완료, 그리고 취소(배송 전)·환불(배송 후)
//  body: { action: "cancel-items", itemIds?, purchaseOrderId?, reason } — 부분 취소·환불 (발주서 단위 또는 상품 줄 단위)
// 처리 권한: 주문한 방송의 셀러, 방송 장소의 창고(스튜디오) 관리자, 최고관리자.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { status?: OrderStatus; reason?: string; action?: string; itemIds?: unknown; purchaseOrderId?: unknown };

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { facility: { select: { ownerId: true } }, payment: true },
    });
    if (!order) return fail("주문을 찾을 수 없습니다.", 404);

    const allowed = user.role === "SUPER_ADMIN" || order.sellerId === user.id || order.facility.ownerId === user.id;
    if (!allowed) return fail("이 주문을 처리할 권한이 없습니다.", 403);

    if (body.action === "cancel-items") {
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter((v): v is string => typeof v === "string").slice(0, 200) : undefined;
      const purchaseOrderId = typeof body.purchaseOrderId === "string" ? body.purchaseOrderId : undefined;
      if (!itemIds?.length && !purchaseOrderId) return fail("취소할 상품이나 발주서를 선택하세요.");
      const result = await cancelOrderItems({ orderId: order.id, itemIds, purchaseOrderId, reason: String(body.reason ?? ""), actorId: user.id });
      return ok(result);
    }

    const status = body.status;
    if (!status || !(ORDER_NEXT_STATUS[order.status] ?? []).includes(status)) {
      return fail("현재 주문 상태에서는 이 처리를 할 수 없습니다.", 409);
    }
    const note = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if ((status === "CANCELLED" || status === "REFUNDED") && !note) {
      return fail(status === "CANCELLED" ? "취소 사유를 입력하세요." : "환불 사유를 입력하세요.");
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

    const updated = await prisma.$transaction((tx) => applyOrderStatusInTx(tx, order.id, status, note, user.id));
    await notifyPurchaseOrderChanges(updated.poChanges);

    await audit({
      actorId: user.id, action: `ORDER_${status}`, entity: "Order", entityId: order.id,
      meta: { from: order.status, to: status, reason: note || undefined },
    });
    return ok({ id: updated.order.id, status: updated.order.status });
  } catch (e) {
    if (e instanceof OrderActionError) return fail(e.message, e.status);
    return handleError(e);
  }
}
