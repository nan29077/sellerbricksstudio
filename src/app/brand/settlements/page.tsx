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
import { formatDate, formatDateTime, formatKRW } from "@/lib/utils";
import { Table } from "@/components/ui/table";
import { PO_STATUS } from "@/lib/brands";
import { pct } from "@/lib/policy";
import { Banknote, CheckCircle2, Clock, Truck } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BrandSettlements() {
  const user = await requireRole(["BRAND_ADMIN"]);
  const shop = user.id === "demo-brand" ? null : await prisma.brandShop.findFirst({ where: brandShopWhere(user.id), select: { id: true, feeRate: true, bankAccount: true } });
  if (!shop) return <EmptyState title="브랜드샵을 먼저 만들어 주세요" description="샵 · 상품 관리에서 브랜드샵을 만들면 정산 내역을 볼 수 있습니다." />;
  const [rows, summary, policy, samples, recentPos] = await Promise.all([
    prisma.brandSettlement.findMany({ where: { brandShopId: shop.id }, orderBy: { periodEnd: "desc" }, take: 60 }),
    brandSalesSummary(shop.id),
    getPolicy(),
    prisma.brandRequest.aggregate({ where: { product: { shopId: shop.id }, kind: "SAMPLE", paymentStatus: "PAID", status: { in: ["SHIPPED", "COMPLETED"] }, brandSettlementId: null }, _sum: { paidAmount: true }, _count: true }),
    prisma.purchaseOrder.findMany({
      where: { brandShopId: shop.id }, orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, poNo: true, createdAt: true, status: true, fulfillment: true, saleAmount: true, supplyAmount: true, brandSettlementId: true,
        seller: { select: { email: true, profile: { select: { name: true } } } }, facility: { select: { name: true } } },
    }),
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
      <Card><CardContent className="space-y-2 p-4 sm:p-5">
        <p className="font-bold text-navy">판매별 공급 수익 (최근 {recentPos.length}건)</p>
        <p className="text-xs text-slate-500">셀러 · 창고(스튜디오)가 판 브랜드 상품의 공급대금에서 수수료 {feeRate}%를 뺀 금액이 브랜드 수익입니다. 취소 · 반품된 발주는 정산에서 빠집니다.</p>
        {recentPos.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">아직 판매된 발주가 없습니다.</p> : (
          <Table headers={["발주일", "발주번호", "판매처", "판매 금액", "공급대금", "수수료", "예상 수익", "상태"]}
            rows={recentPos.map((po) => {
              const closed = po.status === "CANCELLED" || po.status === "RETURNED";
              const fee = pct(po.supplyAmount, feeRate);
              return [formatDateTime(po.createdAt), <span key="n" className="font-mono text-xs">{po.poNo}</span>,
                `${po.seller.profile?.name ?? po.seller.email} · ${po.facility.name}`, formatKRW(po.saleAmount), formatKRW(po.supplyAmount),
                <span key="f" className="text-slate-500">{formatKRW(fee)}</span>, <b key="m" className={closed ? "text-slate-400 line-through" : ""}>{formatKRW(po.supplyAmount - fee)}</b>,
                <span key="s"><Badge tone={closed ? "gray" : po.status === "DELIVERED" ? "green" : "blue"}>{PO_STATUS[po.status]?.label ?? po.status}</Badge>{po.brandSettlementId && <span className="ml-1 text-[11px] text-slate-500">정산서</span>}</span>];
            })} />
        )}
      </CardContent></Card>
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
