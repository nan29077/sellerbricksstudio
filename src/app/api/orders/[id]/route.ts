import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { getPaymentAdapter } from "@/lib/adapters/payment";
import { ORDER_NEXT_STATUS } from "@/lib/status";

// PATCH /api/orders/[id]  body: { status, reason? }
// 주문 처리: 결제완료 → 준비중 → 배송중 → 배송완료, 그리고 취소(배송 전)·환불(배송 후).
// 처리 권한: 주문한 방송의 셀러, 방송 장소의 창고(스튜디오) 관리자, 최고관리자.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { status, reason } = (await req.json().catch(() => ({}))) as { status?: OrderStatus; reason?: string };

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { facility: { select: { ownerId: true } }, payment: true, items: true },
    });
    if (!order) return fail("주문을 찾을 수 없습니다.", 404);

    const allowed = user.role === "SUPER_ADMIN" || order.sellerId === user.id || order.facility.ownerId === user.id;
    if (!allowed) return fail("이 주문을 처리할 권한이 없습니다.", 403);

    if (!status || !(ORDER_NEXT_STATUS[order.status] ?? []).includes(status)) {
      return fail("현재 주문 상태에서는 이 처리를 할 수 없습니다.", 409);
    }
    const note = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
    if ((status === "CANCELLED" || status === "REFUNDED") && !note) {
      return fail(status === "CANCELLED" ? "취소 사유를 입력하세요." : "환불 사유를 입력하세요.");
    }

    // 취소·환불은 PG에 먼저 요청하고, 성공했을 때만 주문을 바꾼다.
    if ((status === "CANCELLED" || status === "REFUNDED") && order.payment?.pgTransactionId && order.payment.status === "PAID") {
      const adapter = getPaymentAdapter();
      const result = status === "CANCELLED"
        ? await adapter.cancelPayment(order.payment.pgTransactionId, note)
        : await adapter.refundPayment(order.payment.pgTransactionId, order.totalAmount, note);
      if (!result.success) return fail(result.failReason ?? "결제사 처리에 실패했습니다. 잠시 후 다시 시도하세요.", 502);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if ((status === "CANCELLED" || status === "REFUNDED") && order.payment) {
        await tx.payment.update({ where: { id: order.payment.id }, data: { status, failReason: note } });
        await tx.paymentEvent.create({
          data: { paymentId: order.payment.id, type: status, payload: JSON.stringify({ reason: note, by: user.id }) },
        });
      }
      // 배송 전 취소는 방송 상품 재고를 되돌린다.
      if (status === "CANCELLED") {
        for (const item of order.items) {
          await tx.liveSessionProduct.update({
            where: { id: item.liveSessionProductId },
            data: { stockSnapshot: { increment: item.quantity } },
          });
        }
        await tx.liveSession.update({ where: { id: order.liveSessionId }, data: { numberVersion: { increment: 1 } } });
      }
      return tx.order.update({ where: { id: order.id }, data: { status } });
    });

    await audit({
      actorId: user.id, action: `ORDER_${status}`, entity: "Order", entityId: order.id,
      meta: { from: order.status, to: status, reason: note || undefined },
    });
    return ok({ id: updated.id, status: updated.status });
  } catch (e) { return handleError(e); }
}
