import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi, BarChart } from "@/components/list/charts";
import { StatusTabs } from "@/components/list/status-tabs";
import { FilterBar } from "@/components/list/filter-bar";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { ResourceForm, PatchButton, DeleteButton } from "@/components/resource-form";
import { getPlatformFeeRate } from "@/lib/booking";
import { SETTLEMENT_STATUS } from "@/lib/status";
import { formatDate, formatKRW } from "@/lib/utils";
import { addDays, addMonths, dateKey, kstParts, kstStartOfMonth } from "@/lib/kst";
import { pageOf, sp, type SP } from "@/lib/list";
import { Banknote, Clock, CheckCircle2, Percent, FilePlus2 } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/settlements";

export default async function AdminSettlements({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const status = sp(searchParams, "status");
  const fid = sp(searchParams, "facility");
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const where: Prisma.FacilitySettlementWhereInput = { ...(status && { status: status as any }), ...(fid && { facilityId: fid }) };
  const mStart = kstStartOfMonth(new Date());
  const yearStart = addMonths(mStart, -11);
  const [rows, total, grouped, unsettled, facilities, feeRate, paidYear] = await Promise.all([
    prisma.facilitySettlement.findMany({ where, skip, take, orderBy: [{ status: "asc" }, { periodEnd: "desc" }], include: { facility: { select: { name: true, bankName: true, bankAccount: true, accountHolder: true } } } }),
    prisma.facilitySettlement.count({ where }),
    prisma.facilitySettlement.groupBy({ by: ["status"], _count: true, _sum: { payoutAmount: true, platformFee: true } }),
    prisma.booking.aggregate({ where: { status: "COMPLETED", facilitySettlementId: null }, _sum: { totalPrice: true }, _count: true }),
    prisma.facility.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getPlatformFeeRate(),
    prisma.facilitySettlement.findMany({ where: { createdAt: { gte: yearStart } }, select: { createdAt: true, platformFee: true } }),
  ]);
  const g = Object.fromEntries(grouped.map((x) => [x.status, x]));
  const all = grouped.reduce((s, x) => s + x._count, 0);
  const lastMonthStart = addMonths(mStart, -1);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  const feeChart = months.map((m) => ({ label: `${kstParts(m).month}월`, value: paidYear.filter((s) => s.createdAt >= m && s.createdAt < addMonths(m, 1)).reduce((a, s) => a + s.platformFee, 0) }));

  return (
    <div className="space-y-5">
      <PageHeader title="정산 관리" description="이용 완료 예약을 기간별 정산서로 만들고, 확정 → 지급 완료까지 처리합니다."
        action={<div className="flex flex-wrap gap-2">
          <ResourceForm url="/api/admin/settlements/fee" method="PUT" title="기본 수수료율" triggerVariant="outline" triggerSize="sm"
            initial={{ rate: feeRate }} fields={[{ name: "rate", label: "플랫폼 기본 수수료율(%)", type: "number", min: 0, max: 100, required: true, help: "이후 생성되는 정산서부터 적용됩니다. 창고(스튜디오)별 수수료율은 창고(스튜디오) 관리에서 설정합니다." }]} />
          <ResourceForm url="/api/admin/settlements" title="정산서 생성" triggerSize="sm" successMessage="정산서를 생성했습니다."
            initial={{ from: dateKey(lastMonthStart), to: dateKey(addDays(mStart, -1)), facilityId: "" }}
            fields={[
              { name: "from", label: "이용일 시작", type: "date", required: true, half: true },
              { name: "to", label: "이용일 끝", type: "date", required: true, half: true },
            ]} />
        </div>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="미정산 이용 완료" value={formatKRW(unsettled._sum.totalPrice ?? 0)} sub={`${unsettled._count}건 · 정산서 생성 필요`} icon={FilePlus2} tone="brand" />
        <Kpi label="정산 대기 · 지급 예정" value={formatKRW((g.PENDING?._sum.payoutAmount ?? 0) + (g.CONFIRMED?._sum.payoutAmount ?? 0))} sub={`${(g.PENDING?._count ?? 0) + (g.CONFIRMED?._count ?? 0)}건`} icon={Clock} tone="blue" />
        <Kpi label="누적 지급 완료" value={formatKRW(g.PAID?._sum.payoutAmount ?? 0)} sub={`${g.PAID?._count ?? 0}건`} icon={CheckCircle2} tone="green" />
        <Kpi label="플랫폼 수수료 수익" value={formatKRW(grouped.reduce((s, x) => s + (x._sum.platformFee ?? 0), 0))} sub={`기본 ${feeRate}%`} icon={Percent} tone="navy" />
      </div>

      <Card><CardContent className="pt-5"><p className="mb-3 text-sm font-extrabold text-navy">월별 플랫폼 수수료 (정산서 생성 기준)</p><BarChart data={feeChart} height={100} format={(n) => formatKRW(n)} /></CardContent></Card>

      <StatusTabs base={BASE} params={searchParams} tabs={[{ value: "", label: "전체", count: all }, ...Object.entries(SETTLEMENT_STATUS).map(([k, v]) => ({ value: k, label: v.label, count: g[k]?._count ?? 0 }))]} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[{ type: "select", key: "facility", label: "창고(스튜디오)", options: facilities.map((f) => ({ value: f.id, label: f.name })) }]} />
        <CsvButton label="이체용 CSV" filename="정산지급목록" headers={["창고(스튜디오)", "기간", "건수", "이용료", "수수료율", "수수료", "지급액", "은행", "계좌", "예금주", "상태"]}
          rows={rows.map((s) => [s.facility.name, `${formatDate(s.periodStart)}~${formatDate(s.periodEnd)}`, s.bookingCount, s.grossAmount, s.feeRate, s.platformFee, s.payoutAmount, s.facility.bankName, s.facility.bankAccount, s.facility.accountHolder, SETTLEMENT_STATUS[s.status]?.label])} />
      </div>

      {rows.length === 0 ? <EmptyState icon={<Banknote className="h-10 w-10" />} title="정산서가 없습니다" description="'정산서 생성'으로 기간 내 이용 완료 예약을 창고(스튜디오)별로 묶으세요." /> : (
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SETTLEMENT_STATUS[s.status]?.tone}>{SETTLEMENT_STATUS[s.status]?.label}</Badge>
                    <span className="text-base font-bold text-navy">{s.facility.name}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)} · {s.bookingCount}건</span>
                  </div>
                  <p className="text-xs text-slate-500">이용료 {formatKRW(s.grossAmount)} − 수수료 {formatKRW(s.platformFee)} ({s.feeRate}%)</p>
                  <p className="text-xs text-slate-500">계좌: {s.facility.bankAccount ? `${s.facility.bankName ?? ""} ${s.facility.bankAccount} (${s.facility.accountHolder ?? "-"})` : <span className="font-semibold text-red-500">미등록</span>}</p>
                  {(s.confirmedAt || s.paidAt) && <p className="text-[11px] text-slate-400">{s.confirmedAt && `확정 ${formatDate(s.confirmedAt)}`} {s.paidAt && `· 지급 ${formatDate(s.paidAt)}`}</p>}
                  {s.memo && <p className="text-xs text-slate-600">📝 {s.memo}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="text-xl font-extrabold text-navy">{formatKRW(s.payoutAmount)}</p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {s.status === "PENDING" && <PatchButton url={`/api/admin/settlements/${s.id}`} body={{ status: "CONFIRMED" }} confirmText="정산 금액을 확정할까요?">확정</PatchButton>}
                    {s.status === "CONFIRMED" && <PatchButton url={`/api/admin/settlements/${s.id}`} body={{ status: "PAID" }} variant="success" confirmText={`${formatKRW(s.payoutAmount)} 지급 완료로 처리할까요?`}>지급 완료</PatchButton>}
                    {s.status === "CONFIRMED" && <PatchButton url={`/api/admin/settlements/${s.id}`} body={{ status: "PENDING" }} variant="ghost">확정 취소</PatchButton>}
                    <ResourceForm url="/api/admin/settlements" id={s.id} title="메모" iconOnly triggerVariant="ghost" initial={{ memo: s.memo ?? "" }} fields={[{ name: "memo", label: "정산 메모", type: "textarea" }]} />
                    {s.status === "PENDING" && <DeleteButton url={`/api/admin/settlements/${s.id}`} confirmText="정산서를 삭제할까요? 포함된 예약은 다시 미정산 상태가 됩니다." />}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
        </div>
      )}
    </div>
  );
}
