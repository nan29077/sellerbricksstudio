export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleError } from "@/lib/http";
import { brandShopIdFor } from "@/lib/brand-access";
import { audit } from "@/lib/audit";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const kst = (d: Date | null) => (d ? new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10) : "");

// GET /api/brand-settlements/[id]/statement — 브랜드 정산서 명세(CSV): 발주 · 유료 샘플 · 정산 후 차감 내역
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const st = await prisma.brandSettlement.findUnique({
      where: { id: params.id },
      include: {
        brandShop: { select: { name: true, businessNumber: true, bankName: true, bankAccount: true, accountHolder: true } },
        purchaseOrders: { select: { poNo: true, fulfillment: true, deliveredAt: true, supplyAmount: true, order: { select: { orderNo: true } }, items: { select: { productName: true, optionLabel: true, quantity: true, supplyPrice: true } } } },
        sampleRequests: { select: { id: true, productName: true, quantity: true, paidAmount: true, createdAt: true } },
        adjustments: { select: { amount: true, reason: true, createdAt: true } },
      },
    });
    if (!st) return fail("정산서를 찾을 수 없습니다.", 404);
    if (user.role !== "SUPER_ADMIN" && (user.role !== "BRAND_ADMIN" || (await brandShopIdFor(user.id)) !== st.brandShopId)) return fail("정산서를 찾을 수 없습니다.", 404);
    const mask = (v: string) => (v.length > 4 ? `${"*".repeat(v.length - 4)}${v.slice(-4)}` : v);
    const rows: string[][] = [
      ["브랜드 정산 명세서"], ["브랜드", st.brandShop.name], ["사업자등록번호", st.brandShop.businessNumber],
      ["정산 기간", `${kst(st.periodStart)} ~ ${kst(st.periodEnd)}`], ["지급 계좌", `${st.brandShop.bankName} ${mask(st.brandShop.bankAccount)} (${st.brandShop.accountHolder})`],
      ["발주 공급가 합계", String(st.supplyAmount)], ["유료 샘플 합계", String(st.sampleAmount)], [`수수료 (${st.feeRate}%)`, String(-st.platformFee)],
      ["정산 후 반품·취소 차감", String(st.autoAdjustment)], ["수동 조정", String(st.adjustment)], ["지급 금액", String(st.payoutAmount)], [],
      ["구분", "번호", "주문번호", "배송 완료일", "상품명", "옵션", "수량", "공급가", "금액"],
    ];
    for (const po of st.purchaseOrders) for (const it of po.items) rows.push(["발주", po.poNo, po.order.orderNo, kst(po.deliveredAt), it.productName, it.optionLabel ?? "", String(it.quantity), String(it.supplyPrice), String(it.supplyPrice * it.quantity)]);
    for (const s of st.sampleRequests) rows.push(["유료 샘플", s.id.slice(-8).toUpperCase(), "", kst(s.createdAt), s.productName, "", String(s.quantity), "", String(s.paidAmount)]);
    for (const a of st.adjustments) rows.push(["차감", "", "", kst(a.createdAt), a.reason, "", "", "", String(a.amount)]);
    await audit({ actorId: user.id, action: "BRAND_SETTLEMENT_STATEMENT", entity: "BrandSettlement", entityId: st.id });
    const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="brand-settlement-${kst(st.periodEnd)}.csv"` } });
  } catch (e) { return handleError(e); }
}
