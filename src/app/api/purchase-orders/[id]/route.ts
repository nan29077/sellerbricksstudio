import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify, notifyAdmins } from "@/lib/notify";
import { PO_STATUS, poActions } from "@/lib/brands";
import { notifyPoPartners, syncOrderFromPurchaseOrders } from "@/lib/purchase-orders";
import { brandRecipients, brandShopIdFor } from "@/lib/brand-access";
import { cancelOrderItems, OrderActionError } from "@/lib/order-actions";

const schema = z.object({
  status: z.enum(["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]).optional(),
  // 브랜드 추가 처리: 출고 불가(취소 요청) · 요청 철회 · 반품 수령 확인 · 교환 재발송
  action: z.enum(["REQUEST_CANCEL", "WITHDRAW_CANCEL", "RETURN_RECEIVED", "EXCHANGE_SHIP"]).optional(),
  carrier: z.string().trim().max(30).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  brandMemo: z.string().trim().max(500).optional(),
  adminMemo: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(300).optional(),
});

// PATCH /api/purchase-orders/[id]
//  브랜드사(대표·팀원): 발주 확인 · 출고(운송장) · 배송완료 · 출고 불가 요청 · 반품 수령 · 교환 재발송
//  최고관리자: 전체 + 취소 · 반품(구매자 결제도 함께 부분 환불) · 메모
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "BRAND_ADMIN" && user.role !== "SUPER_ADMIN") return fail("브랜드사 또는 최고관리자만 처리할 수 있습니다.", 403);
    const data = schema.parse(await req.json().catch(() => ({})));
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: { brandShop: { select: { ownerId: true, name: true } }, order: { select: { id: true, orderNo: true, status: true } } },
    });
    const myShop = user.role === "BRAND_ADMIN" ? await brandShopIdFor(user.id) : null;
    if (!po || (user.role === "BRAND_ADMIN" && po.brandShopId !== myShop)) return fail("발주서를 찾지 못했습니다.", 404);
    const actor = user.role === "SUPER_ADMIN" ? "ADMIN" : "BRAND";
    if (data.adminMemo !== undefined && actor !== "ADMIN") return fail("관리자 메모는 최고관리자만 수정할 수 있습니다.", 403);
    const now = new Date();

    // ---- 브랜드 추가 처리 ----
    if (data.action) {
      const open = po.status === "NEW" || po.status === "CONFIRMED";
      if (data.action === "REQUEST_CANCEL") {
        if (po.fulfillment !== "DROPSHIP" || !open) return fail("출고 전 직배송 발주만 출고 불가를 알릴 수 있습니다.", 409);
        if (!data.reason) return fail("출고할 수 없는 사유를 입력하세요. (예: 품절, 단종)");
        await prisma.purchaseOrder.update({ where: { id: po.id }, data: { cancelRequestedAt: now, cancelRequestReason: data.reason } });
        const body = `${po.brandShop.name} · 주문 ${po.order.orderNo} · ${data.reason} — 주문 화면에서 해당 발주서를 부분 취소해 구매자에게 환불해 주세요.`;
        await notifyPoPartners(po, { title: `브랜드가 출고 불가를 알렸습니다 (${po.poNo})`, body });
        await notifyAdmins({ type: "SYSTEM", title: `출고 불가 요청 · ${po.poNo}`, body, link: `/admin/purchase-orders?po=${po.id}` });
      } else if (data.action === "WITHDRAW_CANCEL") {
        if (!po.cancelRequestedAt || !open) return fail("철회할 출고 불가 요청이 없습니다.", 409);
        await prisma.purchaseOrder.update({ where: { id: po.id }, data: { cancelRequestedAt: null, cancelRequestReason: "" } });
        await notifyPoPartners(po, { title: `브랜드가 출고 불가 요청을 철회했습니다 (${po.poNo})`, body: "정상 출고됩니다." });
      } else if (data.action === "RETURN_RECEIVED") {
        if (po.status !== "RETURNED") return fail("반품 처리된 발주만 수령 확인할 수 있습니다.", 409);
        if (po.returnReceivedAt) return fail("이미 반품 수령을 확인했습니다.", 409);
        await prisma.purchaseOrder.update({ where: { id: po.id }, data: { returnReceivedAt: now, ...(data.brandMemo !== undefined && { brandMemo: data.brandMemo }) } });
        await notifyPoPartners(po, { title: `반품 상품 수령 확인 (${po.poNo})`, body: po.brandShop.name });
      } else {
        if (po.status !== "SHIPPED" && po.status !== "DELIVERED") return fail("배송된 발주만 교환 재발송할 수 있습니다.", 409);
        if (!data.trackingNumber) return fail("교환 상품의 택배사와 운송장 번호를 입력하세요.");
        await prisma.purchaseOrder.update({ where: { id: po.id }, data: { exchangeCarrier: data.carrier ?? "", exchangeTrackingNumber: data.trackingNumber, exchangeShippedAt: now } });
        await notifyPoPartners(po, { title: `교환 상품 발송 (${po.poNo})`, body: `${po.brandShop.name} · ${data.carrier ?? ""} ${data.trackingNumber}` });
      }
      await audit({ actorId: user.id, action: `PO_${data.action}`, entity: "PurchaseOrder", entityId: po.id, meta: { reason: data.reason, tracking: data.trackingNumber } });
      return ok({ id: po.id });
    }

    if (data.status && !poActions(po, actor).includes(data.status)) return fail("현재 상태에서는 이 처리를 할 수 없습니다.", 409);
    if (data.status === "SHIPPED" && !(data.trackingNumber || po.trackingNumber)) return fail("택배사와 운송장 번호를 입력하세요.");
    if ((data.status === "CANCELLED" || data.status === "RETURNED") && !data.reason) return fail("사유를 입력하세요.");

    // 최고관리자 취소·반품: 구매자 결제도 그 발주서만큼 부분 환불한다 (발주서만 닫고 돈은 그대로인 상황 방지)
    if (data.status === "CANCELLED" || data.status === "RETURNED") {
      await cancelOrderItems({ orderId: po.orderId, purchaseOrderId: po.id, reason: `발주 ${PO_STATUS[data.status].label}: ${data.reason}`, actorId: user.id });
      if (data.adminMemo !== undefined) await prisma.purchaseOrder.update({ where: { id: po.id }, data: { adminMemo: data.adminMemo } });
      await audit({ actorId: user.id, action: "PO_UPDATE", entity: "PurchaseOrder", entityId: po.id, meta: { from: po.status, to: data.status, reason: data.reason } });
      return ok({ id: po.id, orderStatus: null });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          ...(data.status && { status: data.status }),
          ...(data.status === "CONFIRMED" && { confirmedAt: now }),
          ...(data.status === "SHIPPED" && { shippedAt: now, confirmedAt: po.confirmedAt ?? now, cancelRequestedAt: null, cancelRequestReason: "" }),
          ...(data.status === "DELIVERED" && { deliveredAt: now }),
          ...(data.carrier !== undefined && { carrier: data.carrier }),
          ...(data.trackingNumber !== undefined && { trackingNumber: data.trackingNumber }),
          ...(data.brandMemo !== undefined && { brandMemo: data.brandMemo }),
          ...(data.adminMemo !== undefined && { adminMemo: data.adminMemo }),
        },
      });
      const orderStatus = data.status === "SHIPPED" || data.status === "DELIVERED" ? await syncOrderFromPurchaseOrders(tx, po.orderId) : null;
      return { orderStatus };
    });

    await audit({ actorId: user.id, action: "PO_UPDATE", entity: "PurchaseOrder", entityId: po.id, meta: { from: po.status, to: data.status, tracking: data.trackingNumber } });
    if (data.status) {
      await notifyPoPartners(po, {
        title: `발주서 ${po.poNo} · ${PO_STATUS[data.status].label}`,
        body: `${po.brandShop.name}${data.trackingNumber ? ` · 운송장 ${data.carrier ?? ""} ${data.trackingNumber}` : ""}${result.orderStatus ? " · 주문 상태 자동 변경" : ""}`,
      });
      if (actor === "ADMIN") await notify({ userId: await brandRecipients(po.brandShopId), type: "SYSTEM", title: `최고관리자가 발주서를 처리했습니다 · ${PO_STATUS[data.status].label}`, body: po.poNo, link: `/brand/orders?po=${po.id}` });
    }
    return ok({ id: po.id, orderStatus: result.orderStatus });
  } catch (e) {
    if (e instanceof OrderActionError) return fail(e.message, e.status);
    return handleError(e);
  }
}
