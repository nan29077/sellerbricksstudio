import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { addDays, parseDateKey } from "@/lib/kst";
import { brandFeeRateOf, getPolicy, pct } from "@/lib/policy";
import { brandRecipients } from "@/lib/brand-access";

// POST { from, to, shopIds? } — 기간 내 배송 완료 발주서 + 발송된 유료 샘플을 브랜드별 정산서로 묶는다.
//  - 기간은 배송 완료일 기준. 정책의 '구매 확정 유예'가 지나지 않은 발주는 다음 정산으로 넘어간다.
//  - 이미 정산된 발주가 반품·취소되어 생긴 차감 항목은 이번 정산서에서 자동으로 뺀다.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    const from = parseDateKey(b.from), to = parseDateKey(b.to);
    if (!from || !to || to < from) return fail("정산 기간을 올바르게 선택하세요.");
    const end = addDays(to, 1);
    const shopFilter = Array.isArray(b.shopIds) && b.shopIds.length ? { in: b.shopIds.map(String) } : undefined;
    const policy = await getPolicy();
    const cutoff = new Date(Date.now() - policy.settleAfterDays * 86400000);
    const deliveredBefore = end < cutoff ? end : cutoff;
    const [pos, samples, adjustments] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          status: "DELIVERED", brandSettlementId: null, ...(shopFilter && { brandShopId: shopFilter }),
          OR: [{ deliveredAt: { gte: from, lt: deliveredBefore } }, { deliveredAt: null, createdAt: { gte: from, lt: deliveredBefore } }],
        },
        select: { id: true, brandShopId: true, supplyAmount: true },
      }),
      prisma.brandRequest.findMany({
        where: {
          kind: "SAMPLE", paymentStatus: "PAID", status: { in: ["SHIPPED", "COMPLETED"] }, brandSettlementId: null, createdAt: { gte: from, lt: end },
          ...(shopFilter && { product: { shopId: shopFilter } }),
        },
        select: { id: true, paidAmount: true, product: { select: { shopId: true } } },
      }),
      prisma.brandSettlementAdjustment.findMany({
        where: { settlementId: null, ...(shopFilter && { brandShopId: shopFilter }) },
        select: { id: true, brandShopId: true, amount: true },
      }),
    ]);
    const shops = new Set([...pos.map((p) => p.brandShopId), ...samples.map((s) => s.product.shopId), ...adjustments.map((a) => a.brandShopId)]);
    if (!shops.size) {
      const waiting = policy.settleAfterDays ? await prisma.purchaseOrder.count({ where: { status: "DELIVERED", brandSettlementId: null, deliveredAt: { gte: from, lt: end } } }) : 0;
      return fail(waiting ? `배송 완료 후 ${policy.settleAfterDays}일(구매 확정 유예)이 지나지 않은 발주 ${waiting}건은 다음 정산에 포함됩니다.` : "해당 기간에 정산할 배송 완료 발주나 유료 샘플이 없습니다.", 404);
    }
    let created = 0;
    for (const shopId of Array.from(shops)) {
      const shop = await prisma.brandShop.findUnique({ where: { id: shopId }, select: { feeRate: true, ownerId: true, name: true } });
      if (!shop) continue;
      const myPos = pos.filter((p) => p.brandShopId === shopId);
      const mySamples = samples.filter((s) => s.product.shopId === shopId);
      const myAdj = adjustments.filter((a) => a.brandShopId === shopId);
      const supplyAmount = myPos.reduce((s, p) => s + p.supplyAmount, 0);
      const sampleAmount = mySamples.reduce((s, x) => s + x.paidAmount, 0);
      const autoAdjustment = myAdj.reduce((s, a) => s + a.amount, 0);
      const feeRate = brandFeeRateOf(policy, shop.feeRate);
      const platformFee = pct(supplyAmount, feeRate) + pct(sampleAmount, policy.sampleFeeRate);
      const gross = supplyAmount + sampleAmount;
      const payout = gross - platformFee + autoAdjustment;
      await prisma.$transaction(async (tx) => {
        const st = await tx.brandSettlement.create({
          data: {
            brandShopId: shopId, periodStart: from, periodEnd: to, poCount: myPos.length, sampleCount: mySamples.length,
            supplyAmount, sampleAmount, grossAmount: gross, feeRate, platformFee, autoAdjustment, payoutAmount: payout,
            ...(myAdj.length && { memo: `정산 후 반품·취소 ${myAdj.length}건 자동 차감 ${autoAdjustment.toLocaleString()}원` }),
          },
        });
        const a = await tx.purchaseOrder.updateMany({ where: { id: { in: myPos.map((p) => p.id) }, brandSettlementId: null }, data: { brandSettlementId: st.id } });
        const c = await tx.brandRequest.updateMany({ where: { id: { in: mySamples.map((s) => s.id) }, brandSettlementId: null }, data: { brandSettlementId: st.id } });
        const d = await tx.brandSettlementAdjustment.updateMany({ where: { id: { in: myAdj.map((x) => x.id) }, settlementId: null }, data: { settlementId: st.id } });
        if (a.count !== myPos.length || c.count !== mySamples.length || d.count !== myAdj.length) throw new Error("다른 정산과 동시에 처리되었습니다. 다시 시도하세요.");
      });
      created += 1;
      await notify({
        userId: await brandRecipients(shopId), type: "SETTLEMENT", title: "브랜드 정산서가 생성되었습니다",
        body: `발주 ${myPos.length}건 · 샘플 ${mySamples.length}건${myAdj.length ? ` · 반품 차감 ${myAdj.length}건` : ""} · 지급 예정 ${payout.toLocaleString()}원`, link: "/brand/settlements",
      });
    }
    await audit({ actorId: admin.id, action: "BRAND_SETTLEMENT_GENERATE", entity: "BrandSettlement", meta: { from: b.from, to: b.to, count: created, adjustments: adjustments.length } });
    return ok({ created, purchaseOrders: pos.length, samples: samples.length, adjustments: adjustments.length }, 201);
  } catch (e) { return handleError(e); }
}
