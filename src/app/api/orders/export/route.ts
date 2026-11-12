export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleError, fail } from "@/lib/http";
import { audit } from "@/lib/audit";
import { ownedFacilityIds } from "@/lib/rbac";
import { ORDER_STATUS } from "@/lib/status";
import { FULFILLMENT_ITEM_SELECT, shipperOf } from "@/lib/order-fulfillment";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // CSV 수식 주입 방지
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// GET /api/orders/export?all=1 — 직접 출고할 주문 목록(엑셀 CSV). 기본은 출고 대기(결제완료 · 준비중, 미출고)만.
//  - 창고(스튜디오) 관리자: 내 창고 방송 주문 중 창고가 보내는 상품
//  - 셀러: 내 공간 방송 주문 중 셀러가 직접 보내는 상품
//  - 최고관리자: 전체 (브랜드 직배송 상품은 브랜드 발주서 내려받기에 있으므로 제외)
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (!["FACILITY_ADMIN", "SELLER", "SUPER_ADMIN"].includes(user.role)) return fail("권한이 없습니다.", 403);
    const all = new URL(req.url).searchParams.get("all") === "1";
    const scope: Prisma.OrderWhereInput = user.role === "SUPER_ADMIN" ? {}
      : user.role === "FACILITY_ADMIN" ? { facilityId: { in: await ownedFacilityIds(user.id) } }
      : { sellerId: user.id, facilityId: null };
    const orders = await prisma.order.findMany({
      where: { ...scope, ...(all ? { status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } } : { status: { in: ["PAID", "PREPARING"] }, localShippedAt: null }) },
      orderBy: { createdAt: "asc" }, take: 5000,
      include: {
        liveSession: { select: { title: true } }, facility: { select: { name: true } },
        items: { select: { productName: true, optionLabel: true, quantity: true, lineTotal: true, ...FULFILLMENT_ITEM_SELECT } },
      },
    });
    const rows = [["주문번호", "주문일시", "방송", "방송 장소", "받는 분", "연락처", "주소", "상품명", "옵션", "수량", "금액", "주문 상태", "택배사", "운송장"]];
    let count = 0;
    for (const o of orders) {
      const lines = o.items.filter((i) => !i.cancelledAt && shipperOf(o, i.liveSessionProduct) !== "BRAND");
      if (!lines.length) continue;
      count += 1;
      for (const it of lines) {
        rows.push([
          o.orderNo, new Date(o.createdAt.getTime() + 9 * 3600000).toISOString().replace("T", " ").slice(0, 16), o.liveSession.title, o.facility?.name ?? "셀러 공간",
          o.buyerName, o.buyerPhone, o.buyerAddress ?? "", it.productName, it.optionLabel ?? "", String(it.quantity), String(it.lineTotal),
          ORDER_STATUS[o.status]?.label ?? o.status, o.shipCarrier ?? "", o.shipTrackingNumber ?? "",
        ]);
      }
    }
    const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
    // 구매자 개인정보가 담긴 파일이므로 누가 언제 받았는지 남긴다
    await audit({ actorId: user.id, action: "ORDER_EXPORT", entity: "Order", meta: { count, all } });
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-to-ship.csv"` },
    });
  } catch (e) { return handleError(e); }
}
