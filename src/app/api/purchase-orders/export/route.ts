export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import type { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import { prisma } from "@/lib/prisma";
import { handleError, fail } from "@/lib/http";
import { FULFILLMENT_LABEL, PO_STATUS, maskAddress, maskName, maskPhone, piiExpired } from "@/lib/brands";
import { getPolicy } from "@/lib/policy";
import { audit } from "@/lib/audit";
import { parseDateKey, addDays } from "@/lib/kst";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // CSV 수식 주입 방지
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// GET /api/purchase-orders/export?status=&from=YYYY-MM-DD&to=YYYY-MM-DD — 발주서 엑셀(CSV) 다운로드
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "BRAND_ADMIN" && user.role !== "SUPER_ADMIN") return fail("권한이 없습니다.", 403);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const from = parseDateKey(url.searchParams.get("from") ?? "");
    const to = parseDateKey(url.searchParams.get("to") ?? "");
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(user.role === "BRAND_ADMIN" && { brandShop: brandShopWhere(user.id) }),
      ...(status && status in PO_STATUS && { status: status as PurchaseOrderStatus }),
      ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lt: addDays(to, 1) }) } }),
    };
    const pos = await prisma.purchaseOrder.findMany({
      where, orderBy: { createdAt: "desc" }, take: 5000,
      include: { items: true, brandShop: { select: { name: true } }, order: { select: { orderNo: true } }, facility: { select: { name: true } } },
    });
    const policy = await getPolicy();
    const hide = (po: (typeof pos)[number]) => user.role === "BRAND_ADMIN" && piiExpired(po, policy.piiRetentionDays);
    const rows = [["발주번호", "발주일시", "브랜드", "상태", "배송방식", "주문번호", "방송 장소", "받는 분", "연락처", "주소", "상품명", "옵션", "수량", "공급가", "공급가 합계", "택배사", "운송장", "브랜드 메모"]];
    for (const po of pos) {
      for (const it of po.items) {
        rows.push([
          po.poNo, new Date(po.createdAt.getTime() + 9 * 3600000).toISOString().replace("T", " ").slice(0, 16), po.brandShop.name,
          PO_STATUS[po.status].label, FULFILLMENT_LABEL[po.fulfillment], po.order.orderNo, (po.facility?.name ?? "셀러 공간"),
          hide(po) ? maskName(po.recipient) : po.recipient, hide(po) ? maskPhone(po.phone) : po.phone, hide(po) ? maskAddress(po.address) : po.address, it.productName, it.optionLabel ?? "", String(it.quantity), String(it.supplyPrice),
          String(it.supplyPrice * it.quantity), po.carrier, po.trackingNumber, po.brandMemo,
        ]);
      }
    }
    const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
    // 구매자 개인정보가 담긴 파일이므로 누가 언제 받았는지 남긴다
    await audit({ actorId: user.id, action: "PO_EXPORT", entity: "PurchaseOrder", meta: { count: pos.length, status, from: url.searchParams.get("from"), to: url.searchParams.get("to") } });
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="purchase-orders.csv"` },
    });
  } catch (e) { return handleError(e); }
}
