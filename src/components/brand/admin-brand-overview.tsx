import { Banknote, ClipboardList, FileText, ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPolicy } from "@/lib/policy";
import { formatKRW } from "@/lib/utils";
import { KpiTile } from "@/components/dashboard/kit";

// 최고관리자 대시보드: 브랜드 · 발주 · 샘플 · 정산 현황
export async function AdminBrandOverview() {
  const policy = await getPolicy();
  const late = new Date(Date.now() - policy.poConfirmHours * 3600000);
  const [pendingShops, newPos, latePos, openSamples, unsettledPo, unsettledOrders] = await Promise.all([
    prisma.brandShop.count({ where: { status: "PENDING" } }),
    prisma.purchaseOrder.count({ where: { status: "NEW" } }),
    prisma.purchaseOrder.count({ where: { status: "NEW", createdAt: { lt: late } } }),
    prisma.brandRequest.count({ where: { status: { in: ["PENDING", "AWAITING_PAYMENT"] } } }),
    prisma.purchaseOrder.aggregate({ where: { status: "DELIVERED", brandSettlementId: null }, _sum: { supplyAmount: true } }),
    prisma.order.aggregate({ where: { status: "DELIVERED", settlementId: null }, _sum: { totalAmount: true, refundedAmount: true }, _count: true }),
  ]).catch(() => [0, 0, 0, 0, { _sum: { supplyAmount: 0 } }, { _sum: { totalAmount: 0, refundedAmount: 0 }, _count: 0 }] as const);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile label="브랜드샵 승인 대기" value={String(pendingShops)} unit="곳" icon={ShoppingBag} tone={pendingShops ? "amber" : "slate"} href="/admin/brands" emphasis={pendingShops > 0} />
      <KpiTile label="신규 발주 (브랜드 확인 전)" value={String(newPos)} unit="건" sub={latePos ? `확인 지연 ${latePos}건` : undefined} icon={FileText} tone={latePos ? "red" : "blue"} href="/admin/purchase-orders?status=NEW" />
      <KpiTile label="샘플 · 입고 신청 대기" value={String(openSamples)} unit="건" icon={ClipboardList} tone="violet" href="/admin/brands/requests" />
      <KpiTile label="미정산 (판매 · 브랜드)" value={formatKRW(((unsettledOrders._sum.totalAmount ?? 0) - (unsettledOrders._sum.refundedAmount ?? 0)))} sub={`브랜드 공급대금 ${formatKRW(unsettledPo._sum.supplyAmount ?? 0)}`} icon={Banknote} tone="green" href="/admin/payouts" />
    </div>
  );
}
