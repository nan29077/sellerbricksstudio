import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { brandShopIdFor } from "@/lib/brand-access";
import { notifyPoPartners, syncOrderFromPurchaseOrders } from "@/lib/purchase-orders";

const schema = z.object({
  rows: z.array(z.object({ poNo: z.string().trim().min(1).max(40), carrier: z.string().trim().max(30).default(""), trackingNumber: z.string().trim().min(1).max(100) })).min(1).max(300),
});

// POST /api/purchase-orders/bulk-ship — 브랜드: 운송장 일괄 입력 (출고 전 직배송 발주 → 배송 중)
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "BRAND_ADMIN") return fail("브랜드사 계정만 사용할 수 있습니다.", 403);
    const shopId = await brandShopIdFor(user.id);
    if (!shopId) return fail("브랜드샵을 찾지 못했습니다.", 404);
    const { rows } = schema.parse(await req.json().catch(() => ({})));
    const results: { poNo: string; ok: boolean; message?: string }[] = [];
    for (const r of rows) {
      const po = await prisma.purchaseOrder.findFirst({ where: { poNo: r.poNo.toUpperCase(), brandShopId: shopId }, include: { brandShop: { select: { name: true } } } });
      if (!po) { results.push({ poNo: r.poNo, ok: false, message: "발주서를 찾지 못했습니다" }); continue; }
      if (po.fulfillment !== "DROPSHIP" || !(po.status === "NEW" || po.status === "CONFIRMED")) { results.push({ poNo: r.poNo, ok: false, message: "출고 전 직배송 발주가 아닙니다" }); continue; }
      const now = new Date();
      const orderStatus = await prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: "SHIPPED", carrier: r.carrier, trackingNumber: r.trackingNumber, shippedAt: now, confirmedAt: po.confirmedAt ?? now, cancelRequestedAt: null, cancelRequestReason: "" },
        });
        return syncOrderFromPurchaseOrders(tx, po.orderId);
      });
      await notifyPoPartners(po, { title: `발주서 ${po.poNo} · 배송 중`, body: `${po.brandShop.name} · 운송장 ${r.carrier} ${r.trackingNumber}${orderStatus ? " · 주문 상태 자동 변경" : ""}` });
      results.push({ poNo: r.poNo, ok: true });
    }
    await audit({ actorId: user.id, action: "PO_BULK_SHIP", entity: "PurchaseOrder", meta: { total: rows.length, ok: results.filter((x) => x.ok).length } });
    return ok({ results });
  } catch (e) { return handleError(e); }
}
