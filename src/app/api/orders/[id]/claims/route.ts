import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/http";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { FULFILLMENT_ITEM_SELECT } from "@/lib/order-fulfillment";
import { CLAIM_LABEL, CLAIM_REASONS, claimOptions } from "@/lib/order-claims";
import { notify } from "@/lib/notify";
import { notifyBuyer } from "@/lib/order-notify";
import { brandRecipients } from "@/lib/brand-access";
import { audit } from "@/lib/audit";
import { notifyFacility } from "@/lib/facility-owner";

// 비회원 구매자의 취소 · 반품 · 교환 요청
//  POST   { phone, type, reason, detail? } — 요청 남기기
//  DELETE { phone, claimId }               — 확인 전 요청 거두기
// 주문할 때 입력한 연락처가 맞아야 한다. (주문 화면 주소만으로는 요청할 수 없게)
const digits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

const postSchema = z.object({
  phone: z.string().min(8, "주문할 때 입력한 연락처를 입력하세요."),
  type: z.enum(["CANCEL", "RETURN", "EXCHANGE"]),
  reason: z.string().trim().min(1, "사유를 선택하세요.").max(60),
  detail: z.string().trim().max(500).optional(),
});

async function loadOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    select: {
      id: true, orderNo: true, status: true, buyerPhone: true, sellerId: true, facilityId: true,
      localShippedAt: true, localDeliveredAt: true, deliveredAt: true,
      items: { select: FULFILLMENT_ITEM_SELECT },
      purchaseOrders: { select: { status: true, fulfillment: true, brandShopId: true } },
      claims: { select: { id: true, status: true } },
    },
  });
}

async function guard(req: NextRequest, orderId: string, phone: string) {
  if (!(await consume(`claim:ip:${clientIp(req)}`, 20, 10 * MINUTE))) return { error: fail("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429) };
  if (!(await consume(`claim:order:${orderId}`, 8, 10 * MINUTE))) return { error: fail("이 주문으로 요청이 너무 많습니다. 10분 후 다시 시도해 주세요.", 429) };
  const order = await loadOrder(orderId);
  if (!order || digits(order.buyerPhone) !== digits(phone)) return { error: fail("주문할 때 입력한 연락처와 다릅니다.", 403) };
  return { order };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = postSchema.parse(await req.json().catch(() => ({})));
    const g = await guard(req, params.id, data.phone);
    if (g.error) return g.error;
    const order = g.order!;
    const opt = claimOptions(order);
    if (!opt.types.includes(data.type)) return fail(opt.reason ?? `지금은 ${CLAIM_LABEL[data.type]} 요청을 할 수 없는 주문입니다.`, 409);
    if (!CLAIM_REASONS[data.type].includes(data.reason)) return fail("사유를 목록에서 선택하세요.");
    if (data.reason === "기타" && !data.detail) return fail("기타 사유를 적어 주세요.");

    const claim = await prisma.orderClaim.create({
      data: { orderId: order.id, type: data.type, reason: data.reason, detail: data.detail || null },
    });
    const label = CLAIM_LABEL[data.type];
    const body = `${data.reason}${data.detail ? ` · ${data.detail.slice(0, 80)}` : ""}`;
    await notify({ userId: order.sellerId, type: "ORDER", email: true, title: `구매자 ${label} 요청 · ${order.orderNo}`, body, link: "/seller/orders?status=claim" });
    if (order.facilityId) {
      await notifyFacility(order.facilityId, { type: "ORDER", email: true, partnerEmail: true, title: `구매자 ${label} 요청 · ${order.orderNo}`, body, link: "/facility/orders?status=claim", exclude: [order.sellerId] });
    }
    // 브랜드 직배송 상품이 있으면 브랜드에도 알린다 (반품 · 교환 회수 준비)
    if (data.type !== "CANCEL") {
      for (const shopId of Array.from(new Set(order.purchaseOrders.filter((p) => p.fulfillment === "DROPSHIP").map((p) => p.brandShopId)))) {
        await notify({ userId: await brandRecipients(shopId), type: "SYSTEM", title: `구매자 ${label} 요청 · 주문 ${order.orderNo}`, body: `${body} · 판매처가 확인 후 처리합니다.`, link: "/brand/orders" });
      }
    }
    await notifyBuyer(order.id, { kind: "CLAIM_RECEIVED", label });
    await audit({ action: "ORDER_CLAIM_CREATE", entity: "Order", entityId: order.id, meta: { claimId: claim.id, type: data.type, reason: data.reason } });
    return ok({ id: claim.id, type: claim.type, status: claim.status }, 201);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const g = await guard(req, params.id, typeof body.phone === "string" ? body.phone : "");
    if (g.error) return g.error;
    const claimId = typeof body.claimId === "string" ? body.claimId : "";
    const r = await prisma.orderClaim.updateMany({ where: { id: claimId, orderId: params.id, status: "REQUESTED" }, data: { status: "WITHDRAWN", resolvedAt: new Date() } });
    if (!r.count) return fail("거둘 수 있는 요청이 없습니다.", 404);
    const order = g.order!;
    await notify({ userId: order.sellerId, type: "ORDER", title: `구매자가 요청을 거뒀습니다 · ${order.orderNo}`, link: "/seller/orders" });
    if (order.facilityId) {
      await notifyFacility(order.facilityId, { type: "ORDER", title: `구매자가 요청을 거뒀습니다 · ${order.orderNo}`, link: "/facility/orders", exclude: [order.sellerId] });
    }
    await audit({ action: "ORDER_CLAIM_WITHDRAW", entity: "Order", entityId: params.id, meta: { claimId } });
    return ok({ id: claimId, status: "WITHDRAWN" });
  } catch (e) { return handleError(e); }
}
