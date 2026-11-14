import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { addDays, parseDateKey } from "@/lib/kst";
import { getPolicy } from "@/lib/policy";
import { SETTLEMENT_ORDER_INCLUDE, splitOrder } from "@/lib/settlement";
import { notifyFacility } from "@/lib/facility-owner";

// POST { from, to } — 기간 내 배송 완료 · 미정산 주문을 셀러 × 공간별 판매 정산서로 묶는다.
//  - 기간은 배송 완료일 기준(예전 주문은 주문일). 정책의 '구매 확정 유예'가 지나지 않은 주문은 다음 정산으로.
//  - 부분 취소된 상품 줄은 빼고 계산한다.
//  - 이미 정산된 주문이 환불·부분 취소되어 생긴 차감 항목은 같은 셀러 × 창고의 이번 정산서에서 자동으로 뺀다.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    const from = parseDateKey(b.from), to = parseDateKey(b.to);
    if (!from || !to || to < from) return fail("정산 기간을 올바르게 선택하세요.");
    const policy = await getPolicy();
    const end = addDays(to, 1);
    const cutoff = new Date(Date.now() - policy.settleAfterDays * 86400000);
    const deliveredBefore = end < cutoff ? end : cutoff;
    const [orders, adjustments] = await Promise.all([
      prisma.order.findMany({
        where: {
          status: "DELIVERED", settlementId: null,
          OR: [{ deliveredAt: { gte: from, lt: deliveredBefore } }, { deliveredAt: null, createdAt: { gte: from, lt: deliveredBefore } }],
        },
        include: SETTLEMENT_ORDER_INCLUDE,
      }),
      prisma.salesAdjustment.findMany({ where: { settlementId: null } }),
    ]);
    if (!orders.length && !adjustments.length) {
      const waiting = policy.settleAfterDays ? await prisma.order.count({ where: { status: "DELIVERED", settlementId: null, deliveredAt: { gte: from, lt: end } } }) : 0;
      return fail(waiting ? `배송 완료 후 ${policy.settleAfterDays}일(구매 확정 유예)이 지나지 않은 주문 ${waiting}건은 다음 정산에 포함됩니다.` : "해당 기간에 정산할 배송 완료 주문이 없습니다.", 404);
    }
    // 셀러 × 공간별. 셀러 공간 방송(창고 없음)은 셀러 단독 정산서
    type Group = { sellerId: string; facilityId: string | null; orders: typeof orders; adjustments: typeof adjustments };
    const groups = new Map<string, Group>();
    const groupOf = (sellerId: string, facilityId: string | null) => {
      const key = `${sellerId}:${facilityId ?? "own"}`;
      const g = groups.get(key) ?? { sellerId, facilityId, orders: [], adjustments: [] };
      groups.set(key, g);
      return g;
    };
    for (const o of orders) groupOf(o.sellerId, o.facilityId).orders.push(o);
    for (const a of adjustments) groupOf(a.sellerId, a.facilityId).adjustments.push(a);
    let created = 0;
    for (const g of Array.from(groups.values())) {
      const sum = { gross: 0, platformFee: 0, brand: 0, seller: 0, facility: 0 };
      for (const o of g.orders) { const r = splitOrder(o, policy); for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += r[k]; }
      for (const a of g.adjustments) { sum.gross += a.grossAmount; sum.platformFee += a.platformFee; sum.brand += a.brandAmount; sum.seller += a.sellerAmount; sum.facility += a.facilityAmount; }
      const st = await prisma.$transaction(async (tx) => {
        const s = await tx.settlement.create({
          data: {
            sellerId: g.sellerId, facilityId: g.facilityId, periodStart: from, periodEnd: to, orderCount: g.orders.length, adjustmentCount: g.adjustments.length,
            grossAmount: sum.gross, commissionAmount: sum.seller, facilityAmount: sum.facility, platformFee: sum.platformFee, brandAmount: sum.brand,
            ...(g.adjustments.length && { memo: `정산 후 환불·부분 취소 ${g.adjustments.length}건 자동 차감` }),
          },
        });
        const linked = await tx.order.updateMany({ where: { id: { in: g.orders.map((o) => o.id) }, settlementId: null }, data: { settlementId: s.id } });
        const adj = await tx.salesAdjustment.updateMany({ where: { id: { in: g.adjustments.map((a) => a.id) }, settlementId: null }, data: { settlementId: s.id } });
        if (linked.count !== g.orders.length || adj.count !== g.adjustments.length) throw new Error("다른 정산과 동시에 처리되었습니다. 다시 시도하세요.");
        return s;
      });
      created += 1;
      const f = st.facilityId ? await prisma.facility.findUnique({ where: { id: st.facilityId }, select: { id: true, name: true, operationType: true } }) : null;
      const extra = g.adjustments.length ? ` · 환불 차감 ${g.adjustments.length}건` : "";
      await notify({ userId: st.sellerId, type: "SETTLEMENT", title: "판매 정산서가 생성되었습니다", body: `${f?.name ?? ""} · 주문 ${g.orders.length}건${extra} · 셀러 정산 ${sum.seller.toLocaleString()}원`, link: "/seller/settlements?tab=sales" });
      // 창고 몫: 직영은 본사 수입, 제휴는 지급 대상 — 담당 매니저에게만 알린다 (정산서는 최고관리자가 만들었다)
      if (f) await notifyFacility(f.id, { type: "SETTLEMENT", exclude: [admin.id], title: "판매 정산서가 생성되었습니다", body: `${f.name} · 주문 ${g.orders.length}건${extra} · 창고 몫 ${sum.facility.toLocaleString()}원${f.operationType === "PARTNER" ? " (제휴 지급 대상)" : " (직영 · 본사 수입)"}`, link: "/facility/settlements" });
    }
    await audit({ actorId: admin.id, action: "SALES_SETTLEMENT_GENERATE", entity: "Settlement", meta: { from: b.from, to: b.to, count: created, orders: orders.length, adjustments: adjustments.length } });
    return ok({ created, orders: orders.length, adjustments: adjustments.length }, 201);
  } catch (e) { return handleError(e); }
}
