import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { CsvButton } from "@/components/list/csv-button";
import { ResourceForm, PatchButton, DeleteButton } from "@/components/resource-form";
import { SETTLEMENT_STATUS } from "@/lib/status";
import { formatDate, formatKRW, cn } from "@/lib/utils";
import { addDays, addMonths, dateKey, kstStartOfMonth } from "@/lib/kst";
import { sp, withParams, type SP } from "@/lib/list";
import { Banknote, Clock, Percent, ShoppingBag, Store } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/payouts";

export default async function AdminPayouts({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const tab = sp(searchParams, "tab") === "brand" ? "brand" : "sales";
  const status = sp(searchParams, "status");
  const mStart = kstStartOfMonth(new Date());
  const range = { from: dateKey(addMonths(mStart, -1)), to: dateKey(addDays(mStart, -1)) };

  const [sales, brands, unsettledOrders, unsettledPos, unsettledSamples, salesSum, brandSum] = await Promise.all([
    tab === "sales" ? prisma.settlement.findMany({
      where: status ? { status: status as any } : {}, orderBy: [{ status: "asc" }, { periodEnd: "desc" }], take: 100,
      include: { seller: { select: { email: true, profile: { select: { name: true } } } }, facility: { select: { name: true, bankName: true, bankAccount: true, accountHolder: true } } },
    }) : Promise.resolve([]),
    tab === "brand" ? prisma.brandSettlement.findMany({
      where: status ? { status: status as any } : {}, orderBy: [{ status: "asc" }, { periodEnd: "desc" }], take: 100,
      include: { brandShop: { select: { name: true, bankName: true, bankAccount: true, accountHolder: true } } },
    }) : Promise.resolve([]),
    prisma.order.aggregate({ where: { status: "DELIVERED", settlementId: null }, _sum: { totalAmount: true, refundedAmount: true }, _count: true }),
    prisma.purchaseOrder.aggregate({ where: { status: "DELIVERED", brandSettlementId: null }, _sum: { supplyAmount: true }, _count: true }),
    prisma.brandRequest.aggregate({ where: { kind: "SAMPLE", paymentStatus: "PAID", status: { in: ["SHIPPED", "COMPLETED"] }, brandSettlementId: null }, _sum: { paidAmount: true }, _count: true }),
    prisma.settlement.aggregate({ _sum: { platformFee: true } }),
    prisma.brandSettlement.aggregate({ _sum: { platformFee: true } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="판매 · 브랜드 정산" description="구매자 결제는 플랫폼이 받고, 배송 완료된 주문을 기준으로 셀러 · 창고(스튜디오) · 브랜드에 정산합니다. 수수료는 수수료 · 운영 정책에서 바꿀 수 있습니다."
        action={<div className="flex flex-wrap gap-2">
          <Link href="/admin/policy" className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-semibold">수수료 정책</Link>
          {tab === "sales"
            ? <ResourceForm url="/api/admin/sales-settlements" title="판매 정산서 생성" triggerSize="sm" successMessage="판매 정산서를 생성했습니다." initial={range}
                fields={[{ name: "from", label: "주문일 시작", type: "date", required: true, half: true }, { name: "to", label: "주문일 끝", type: "date", required: true, half: true }]} />
            : <ResourceForm url="/api/admin/brand-settlements" title="브랜드 정산서 생성" triggerSize="sm" successMessage="브랜드 정산서를 생성했습니다." initial={range}
                fields={[{ name: "from", label: "발주일 시작", type: "date", required: true, half: true }, { name: "to", label: "발주일 끝", type: "date", required: true, half: true }]} />}
        </div>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="미정산 배송완료 주문" value={formatKRW((unsettledOrders._sum.totalAmount ?? 0) - (unsettledOrders._sum.refundedAmount ?? 0))} sub={`${unsettledOrders._count}건`} icon={Store} tone="brand" />
        <Kpi label="미정산 브랜드 발주" value={formatKRW(unsettledPos._sum.supplyAmount ?? 0)} sub={`발주 ${unsettledPos._count}건`} icon={ShoppingBag} tone="blue" />
        <Kpi label="미정산 유료 샘플" value={formatKRW(unsettledSamples._sum.paidAmount ?? 0)} sub={`${unsettledSamples._count}건`} icon={Clock} tone="navy" />
        <Kpi label="누적 플랫폼 수수료" value={formatKRW((salesSum._sum.platformFee ?? 0) + (brandSum._sum.platformFee ?? 0))} sub="정산서 기준" icon={Percent} tone="green" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ k: "sales", label: "셀러 · 창고(스튜디오) 판매 정산" }, { k: "brand", label: "브랜드 정산" }].map((t) => (
          <Link key={t.k} href={withParams(BASE, {}, { tab: t.k === "sales" ? undefined : t.k })}
            className={cn("rounded-full border px-4 py-2 text-sm font-semibold", tab === t.k ? "border-navy bg-navy text-white" : "bg-white text-slate-600")}>{t.label}</Link>
        ))}
        <span className="mx-1" />
        {[["", "전체"], ...Object.entries(SETTLEMENT_STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <Link key={k || "all"} href={withParams(BASE, searchParams, { status: k || undefined })}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", (status ?? "") === k ? "border-brand-500 bg-brand-50" : "bg-white text-slate-600")}>{label}</Link>
        ))}
      </div>

      {tab === "sales" ? (
        sales.length === 0 ? <EmptyState icon={<Banknote className="h-10 w-10" />} title="판매 정산서가 없습니다" description="'판매 정산서 생성'으로 기간 내 배송 완료 주문을 셀러 × 창고(스튜디오)별로 묶으세요." /> : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <CsvButton label="이체용 CSV" filename="판매정산" headers={["셀러", "창고(스튜디오)", "기간", "주문수", "매출", "플랫폼수수료", "브랜드대금", "셀러정산", "창고정산", "창고 계좌", "상태"]}
                rows={sales.map((s) => [s.seller.profile?.name ?? s.seller.email, s.facility.name, `${formatDate(s.periodStart)}~${formatDate(s.periodEnd)}`, s.orderCount, s.grossAmount, s.platformFee, s.brandAmount, s.commissionAmount, s.facilityAmount, `${s.facility.bankName ?? ""} ${s.facility.bankAccount ?? ""} ${s.facility.accountHolder ?? ""}`, SETTLEMENT_STATUS[s.status]?.label])} />
            </div>
            {sales.map((s) => (
              <Card key={s.id}><CardContent className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SETTLEMENT_STATUS[s.status]?.tone}>{SETTLEMENT_STATUS[s.status]?.label}</Badge>
                    <span className="font-bold text-navy">{s.seller.profile?.name ?? s.seller.email} · {s.facility.name}</span>
                    <span className="text-xs text-slate-500">{formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)} · 주문 {s.orderCount}건</span>
                  </div>
                  <p className="text-xs text-slate-500">매출 {formatKRW(s.grossAmount)} = 플랫폼 {formatKRW(s.platformFee)} + 브랜드 {formatKRW(s.brandAmount)} + 셀러 {formatKRW(s.commissionAmount)} + 창고 {formatKRW(s.facilityAmount)}</p>
                  {s.memo && <p className="text-xs text-slate-600">메모: {s.memo}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="text-sm">셀러 <b>{formatKRW(s.commissionAmount)}</b> · 창고 <b>{formatKRW(s.facilityAmount)}</b></p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {s.status === "PENDING" && <PatchButton url={`/api/admin/sales-settlements/${s.id}`} body={{ status: "CONFIRMED" }} confirmText="정산 금액을 확정할까요?">확정</PatchButton>}
                    {s.status === "CONFIRMED" && <PatchButton url={`/api/admin/sales-settlements/${s.id}`} body={{ status: "PAID" }} variant="success" confirmText="지급 완료로 처리할까요?">지급 완료</PatchButton>}
                    {s.status === "CONFIRMED" && <PatchButton url={`/api/admin/sales-settlements/${s.id}`} body={{ status: "PENDING" }} variant="ghost">확정 취소</PatchButton>}
                    <ResourceForm url="/api/admin/sales-settlements" id={s.id} title="메모" iconOnly triggerVariant="ghost" initial={{ memo: s.memo ?? "" }} fields={[{ name: "memo", label: "정산 메모", type: "textarea" }]} />
                    {s.status === "PENDING" && <DeleteButton url={`/api/admin/sales-settlements/${s.id}`} confirmText="정산서를 삭제할까요? 포함된 주문은 다시 미정산이 됩니다." />}
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        )
      ) : (
        brands.length === 0 ? <EmptyState icon={<Banknote className="h-10 w-10" />} title="브랜드 정산서가 없습니다" description="'브랜드 정산서 생성'으로 배송 완료 발주와 발송된 유료 샘플을 브랜드별로 묶으세요." /> : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <CsvButton label="이체용 CSV" filename="브랜드정산" headers={["브랜드", "기간", "발주", "샘플", "공급대금", "샘플매출", "수수료율", "수수료", "조정", "지급액", "은행", "계좌", "예금주", "상태"]}
                rows={brands.map((s) => [s.brandShop.name, `${formatDate(s.periodStart)}~${formatDate(s.periodEnd)}`, s.poCount, s.sampleCount, s.supplyAmount, s.sampleAmount, s.feeRate, s.platformFee, s.adjustment, s.payoutAmount, s.brandShop.bankName, s.brandShop.bankAccount, s.brandShop.accountHolder, SETTLEMENT_STATUS[s.status]?.label])} />
            </div>
            {brands.map((s) => (
              <Card key={s.id}><CardContent className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SETTLEMENT_STATUS[s.status]?.tone}>{SETTLEMENT_STATUS[s.status]?.label}</Badge>
                    <span className="font-bold text-navy">{s.brandShop.name}</span>
                    <span className="text-xs text-slate-500">{formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)} · 발주 {s.poCount}건 · 샘플 {s.sampleCount}건</span>
                  </div>
                  <p className="text-xs text-slate-500">공급대금 {formatKRW(s.supplyAmount)} + 샘플 {formatKRW(s.sampleAmount)} − 수수료 {formatKRW(s.platformFee)} ({s.feeRate}%){s.adjustment ? ` ${s.adjustment > 0 ? "+" : "−"} 조정 ${formatKRW(Math.abs(s.adjustment))}` : ""}</p>
                  <p className="text-xs text-slate-500">계좌: {s.brandShop.bankAccount ? `${s.brandShop.bankName} ${s.brandShop.bankAccount} (${s.brandShop.accountHolder})` : <span className="font-semibold text-red-500">미등록</span>}</p>
                  {s.memo && <p className="text-xs text-slate-600">메모: {s.memo}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="text-xl font-extrabold text-navy">{formatKRW(s.payoutAmount)}</p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {s.status === "PENDING" && <PatchButton url={`/api/admin/brand-settlements/${s.id}`} body={{ status: "CONFIRMED" }} confirmText="정산 금액을 확정할까요?">확정</PatchButton>}
                    {s.status === "CONFIRMED" && <PatchButton url={`/api/admin/brand-settlements/${s.id}`} body={{ status: "PAID" }} variant="success" confirmText={`${formatKRW(s.payoutAmount)} 지급 완료로 처리할까요?`}>지급 완료</PatchButton>}
                    {s.status === "CONFIRMED" && <PatchButton url={`/api/admin/brand-settlements/${s.id}`} body={{ status: "PENDING" }} variant="ghost">확정 취소</PatchButton>}
                    <ResourceForm url="/api/admin/brand-settlements" id={s.id} title="조정 · 메모" iconOnly triggerVariant="ghost" initial={{ adjustment: s.adjustment, memo: s.memo ?? "" }}
                      fields={[{ name: "adjustment", label: "수동 조정 금액(원, 차감은 음수)", type: "number", help: "정산 대기 상태에서만 바꿀 수 있습니다. 반품·이미 정산된 건 차감 등에 사용하세요." }, { name: "memo", label: "정산 메모", type: "textarea" }]} />
                    {s.status === "PENDING" && <DeleteButton url={`/api/admin/brand-settlements/${s.id}`} confirmText="정산서를 삭제할까요? 포함된 발주·샘플은 다시 미정산이 됩니다." />}
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
