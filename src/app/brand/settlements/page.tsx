import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { SETTLEMENT_STATUS } from "@/lib/status";
import { brandFeeRateOf, getPolicy } from "@/lib/policy";
import { brandSalesSummary } from "@/lib/purchase-orders";
import { formatDate, formatKRW } from "@/lib/utils";
import { Banknote, CheckCircle2, Clock, Truck } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BrandSettlements() {
  const user = await requireRole(["BRAND_ADMIN"]);
  const shop = user.id === "demo-brand" ? null : await prisma.brandShop.findFirst({ where: brandShopWhere(user.id), select: { id: true, feeRate: true, bankAccount: true } });
  if (!shop) return <EmptyState title="브랜드샵을 먼저 만들어 주세요" description="샵 · 상품 관리에서 브랜드샵을 만들면 정산 내역을 볼 수 있습니다." />;
  const [rows, summary, policy, samples] = await Promise.all([
    prisma.brandSettlement.findMany({ where: { brandShopId: shop.id }, orderBy: { periodEnd: "desc" }, take: 60 }),
    brandSalesSummary(shop.id),
    getPolicy(),
    prisma.brandRequest.aggregate({ where: { product: { shopId: shop.id }, kind: "SAMPLE", paymentStatus: "PAID", status: { in: ["SHIPPED", "COMPLETED"] }, brandSettlementId: null }, _sum: { paidAmount: true }, _count: true }),
  ]);
  const feeRate = brandFeeRateOf(policy, shop.feeRate);
  const waiting = rows.filter((r) => r.status !== "PAID").reduce((s, r) => s + r.payoutAmount, 0);
  return (
    <div className="space-y-5">
      <PageHeader title="정산 내역" description={`배송 완료된 발주의 공급대금과 발송된 유료 샘플 매출에서 수수료(${feeRate}%${policy.sampleFeeRate ? `, 샘플 ${policy.sampleFeeRate}%` : ""})를 뺀 금액을 플랫폼이 지급합니다.`} />
      {!shop.bankAccount && <Link href="/brand/shop" className="block rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">정산 계좌가 등록되지 않았습니다. 샵 꾸미기 · 정보 → 사업자 · 정산 정보에서 등록하세요.</Link>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="진행 중 발주" value={formatKRW(summary.openAmount)} sub={`${summary.openCount}건 (배송 완료 전)`} icon={Truck} tone="blue" />
        <Kpi label="정산 예정 (배송 완료)" value={formatKRW(summary.unsettledAmount + (samples._sum.paidAmount ?? 0))} sub={`발주 ${summary.unsettledCount}건 · 샘플 ${samples._count}건`} icon={Clock} tone="brand" />
        <Kpi label="정산서 지급 대기" value={formatKRW(waiting)} icon={Banknote} tone="navy" />
        <Kpi label="누적 지급 완료" value={formatKRW(summary.paidOut)} icon={CheckCircle2} tone="green" />
      </div>
      {rows.length === 0 ? <EmptyState title="아직 정산서가 없습니다" description="최고관리자가 정산 기간을 마감하면 정산서가 만들어집니다." /> : (
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2"><Badge tone={SETTLEMENT_STATUS[s.status]?.tone}>{SETTLEMENT_STATUS[s.status]?.label}</Badge>
                  <span className="text-sm font-bold text-navy">{formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)}</span></div>
                <p className="text-xs text-slate-500">발주 {s.poCount}건 {formatKRW(s.supplyAmount)} + 샘플 {s.sampleCount}건 {formatKRW(s.sampleAmount)} − 수수료 {formatKRW(s.platformFee)}{s.autoAdjustment ? ` · 반품 차감 ${formatKRW(s.autoAdjustment)}` : ""}{s.adjustment ? ` · 조정 ${formatKRW(s.adjustment)}` : ""}</p>
                {s.memo && <p className="text-xs text-slate-600">메모: {s.memo}</p>}
                {s.paidAt && <p className="text-[11px] text-slate-400">지급 {formatDate(s.paidAt)}</p>}
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-navy">{formatKRW(s.payoutAmount)}</p>
                <a href={`/api/brand-settlements/${s.id}/statement`} className="mt-1 inline-block text-xs font-semibold text-brand-700 underline underline-offset-2">정산 명세 내려받기 (CSV)</a>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
