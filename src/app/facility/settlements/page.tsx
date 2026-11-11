import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { Kpi, BarChart } from "@/components/list/charts";
import { CsvButton } from "@/components/list/csv-button";
import { getPlatformFeeRate, splitFee } from "@/lib/booking";
import { computeSettlement, revenueLines } from "@/lib/settlement";
import { RevenueTable } from "@/components/settlement/revenue-table";
import { formatDate, formatDateTime, formatKRW } from "@/lib/utils";
import { addMonths, hoursBetween, kstParts, kstStartOfMonth } from "@/lib/kst";
import { growth } from "@/lib/list";
import { Banknote, Clock, CheckCircle2, TrendingUp, Info, Landmark } from "lucide-react";

export const dynamic = "force-dynamic";
const SETTLEMENT_STATUS: Record<string, { label: string; tone: "yellow" | "blue" | "green" }> = {
  PENDING: { label: "정산 대기", tone: "yellow" }, CONFIRMED: { label: "지급 예정", tone: "blue" }, PAID: { label: "지급 완료", tone: "green" },
};

export default async function FacilitySettlements() {
  const user = await requireRole(["FACILITY_ADMIN"]);
  const ids = await ownedFacilityIds(user.id);
  const facilities = await prisma.facility.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, bankName: true, bankAccount: true, accountHolder: true } });
  const monthStart = kstStartOfMonth(new Date());
  const yearStart = addMonths(monthStart, -11);

  const [salesSummary, salesSettlements, revenue] = await Promise.all([
    computeSettlement({ facilityIds: ids }).catch(() => null),
    prisma.settlement.findMany({ where: { facilityId: { in: ids } }, orderBy: { periodEnd: "desc" }, take: 30, include: { facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } } }),
    revenueLines({ facilityIds: ids }).catch(() => []),
  ]);
  const [settlements, unsettled, yearRows] = await Promise.all([
    prisma.facilitySettlement.findMany({ where: { facilityId: { in: ids } }, orderBy: { periodEnd: "desc" }, include: { facility: { select: { name: true } } } }),
    prisma.booking.findMany({ where: { facilityId: { in: ids }, status: "COMPLETED", facilitySettlementId: null }, orderBy: { startAt: "desc" }, include: { facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } } }),
    prisma.booking.findMany({ where: { facilityId: { in: ids }, status: "COMPLETED", startAt: { gte: yearStart } }, select: { startAt: true, totalPrice: true } }),
  ]);
  const rates = new Map(await Promise.all(ids.map(async (id) => [id, await getPlatformFeeRate(id)] as const)));
  const expected = unsettled.reduce((s, b) => s + splitFee(b.totalPrice, rates.get(b.facilityId) ?? 10).payoutAmount, 0);
  const waiting = settlements.filter((s) => s.status !== "PAID").reduce((a, s) => a + s.payoutAmount, 0);
  const paid = settlements.filter((s) => s.status === "PAID").reduce((a, s) => a + s.payoutAmount, 0);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  const monthly = months.map((m) => ({ label: `${kstParts(m).month}월`, value: yearRows.filter((b) => b.startAt >= m && b.startAt < addMonths(m, 1)).reduce((s, b) => s + b.totalPrice, 0) }));
  const noBank = facilities.filter((f) => !f.bankAccount);
  const rateText = Array.from(new Set(Array.from(rates.values()))).map((r) => `${r}%`).join(", ");

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="정산 내역" description="이용 완료된 예약의 이용료에서 플랫폼 수수료를 제외한 금액이 정산됩니다." />

      {noBank.length > 0 && (
        <Link href="/facility/profile" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <Landmark className="h-5 w-5" />정산 계좌가 등록되지 않은 창고(스튜디오)가 있습니다: {noBank.map((f) => f.name).join(", ")} — 정보 · 편집에서 등록하세요.
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="정산 예정 (미정산)" value={formatKRW(expected)} sub={`이용 완료 ${unsettled.length}건`} icon={Clock} tone="brand" />
        <Kpi label="정산 대기 · 지급 예정" value={formatKRW(waiting)} sub={`${settlements.filter((s) => s.status !== "PAID").length}건`} icon={Banknote} tone="blue" />
        <Kpi label="누적 지급 완료" value={formatKRW(paid)} icon={CheckCircle2} tone="green" />
        <Kpi label="이번 달 이용료" value={formatKRW(monthly[11].value)} delta={growth(monthly[11].value, monthly[10].value)} sub="지난달 대비" icon={TrendingUp} tone="navy" />
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-[#E9E5DC] bg-white px-4 py-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p>플랫폼 수수료율 <b className="text-navy">{rateText || "10%"}</b> · 예약을 <b>이용 완료</b>로 처리해야 정산 대상이 됩니다. 운영팀이 기간별 정산서를 만들면 &lsquo;정산 대기 → 지급 예정 → 지급 완료&rsquo; 순서로 진행됩니다.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">라이브 판매 정산</CardTitle>
          <p className="text-xs text-muted-foreground">구매자 결제는 플랫폼이 받고, 배송 완료된 주문을 기준으로 판매 수수료 · 브랜드 공급대금 · 셀러 수수료를 뺀 금액을 창고(스튜디오)에 지급합니다.</p></CardHeader>
        <CardContent className="space-y-3">
          {salesSummary && <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <p className="rounded-xl bg-slate-50 p-3">판매 매출<br /><b>{formatKRW(salesSummary.gross)}</b></p>
            <p className="rounded-xl bg-slate-50 p-3">플랫폼 수수료<br /><b>{formatKRW(salesSummary.platformFee)}</b></p>
            <p className="rounded-xl bg-slate-50 p-3">브랜드 공급대금<br /><b>{formatKRW(salesSummary.brandAmount)}</b></p>
            <p className="rounded-xl bg-brand-50 p-3">창고(스튜디오) 몫 (예상)<br /><b>{formatKRW(salesSummary.facilityAmount)}</b></p>
          </div>}
          {salesSettlements.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">아직 판매 정산서가 없습니다.</p> : (
            <Table headers={["정산 기간", "창고(스튜디오)", "셀러", "주문", "매출", "창고 지급액", "상태"]}
              rows={salesSettlements.map((s) => [`${formatDate(s.periodStart)} ~ ${formatDate(s.periodEnd)}`, s.facility.name, s.seller.profile?.name ?? s.seller.email, `${s.orderCount}건`, formatKRW(s.grossAmount), <b key="p">{formatKRW(s.facilityAmount)}</b>, <Badge key="s" tone={SETTLEMENT_STATUS[s.status]?.tone}>{SETTLEMENT_STATUS[s.status]?.label}</Badge>])} />
          )}
        </CardContent>
      </Card>

      <RevenueTable rows={revenue} perspective="FACILITY" />

      <Card><CardHeader><CardTitle className="text-base">월별 이용 완료 매출 (12개월)</CardTitle></CardHeader><CardContent><BarChart data={monthly} format={(n) => formatKRW(n)} /></CardContent></Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">정산서</CardTitle>
          <CsvButton label="CSV" filename="정산서" headers={["창고(스튜디오)", "시작", "종료", "건수", "이용료합계", "수수료율", "수수료", "지급액", "상태", "지급일"]}
            rows={settlements.map((s) => [s.facility.name, formatDate(s.periodStart), formatDate(s.periodEnd), s.bookingCount, s.grossAmount, s.feeRate, s.platformFee, s.payoutAmount, SETTLEMENT_STATUS[s.status]?.label, s.paidAt ? formatDate(s.paidAt) : ""])} />
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? <EmptyState className="py-10" title="아직 생성된 정산서가 없습니다" /> : (
            <Table headers={["정산 기간", "창고(스튜디오)", "건수", "이용료 합계", "수수료", "지급액", "상태"]}
              rows={settlements.map((s) => [
                `${formatDate(s.periodStart)} ~ ${formatDate(s.periodEnd)}`, s.facility.name, `${s.bookingCount}건`, formatKRW(s.grossAmount),
                <span key="f" className="text-slate-500">-{formatKRW(s.platformFee)} ({s.feeRate}%)</span>, <b key="p">{formatKRW(s.payoutAmount)}</b>,
                <span key="s"><Badge tone={SETTLEMENT_STATUS[s.status]?.tone}>{SETTLEMENT_STATUS[s.status]?.label}</Badge>{s.paidAt && <span className="ml-1 text-[11px] text-slate-500">{formatDate(s.paidAt)}</span>}</span>,
              ])} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">정산 예정 예약 ({unsettled.length}건)</CardTitle></CardHeader>
        <CardContent>
          {unsettled.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">정산을 기다리는 이용 완료 예약이 없습니다.</p> : (
            <Table headers={["이용일", "창고(스튜디오)", "셀러", "이용 시간", "이용료", "예상 지급액"]}
              rows={unsettled.slice(0, 100).map((b) => [formatDateTime(b.startAt), b.facility.name, b.seller.profile?.name ?? b.seller.email, `${hoursBetween(b.startAt, b.endAt)}시간`, formatKRW(b.totalPrice), <b key="p">{formatKRW(splitFee(b.totalPrice, rates.get(b.facilityId) ?? 10).payoutAmount)}</b>])} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
