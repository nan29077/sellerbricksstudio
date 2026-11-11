import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { Kpi, BarChart, ProgressRow } from "@/components/list/charts";
import { FilterBar } from "@/components/list/filter-bar";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { computeSettlement, revenueLines } from "@/lib/settlement";
import { RevenueTable } from "@/components/settlement/revenue-table";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDate, formatDateTime, formatKRW } from "@/lib/utils";
import { addMonths, hoursBetween, kstParts, kstStartOfMonth } from "@/lib/kst";
import { dateRange, growth, pageOf, sp, withParams, type SP } from "@/lib/list";
import { cn } from "@/lib/utils";
import { Wallet, CalendarCheck, TrendingUp, Building2, Receipt, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/seller/settlements";
const SETTLE_STATUS: Record<string, { label: string; tone: "yellow" | "blue" | "green" }> = {
  PENDING: { label: "정산 대기", tone: "yellow" }, CONFIRMED: { label: "정산 확정", tone: "blue" }, PAID: { label: "지급 완료", tone: "green" },
};

export default async function SellerSettlements({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  // 창고(스튜디오) 이용료가 무료가 되어 판매 정산을 기본 탭으로 보여 준다.
  const tab = sp(searchParams, "tab") === "usage" ? "usage" : "sales";
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const monthStart = kstStartOfMonth(new Date());
  const yearStart = addMonths(monthStart, -11);
  const paidStatuses = ["APPROVED", "COMPLETED"] as const;

  const where: Prisma.BookingWhereInput = {
    sellerId: user.id, status: { in: [...paidStatuses] },
    ...(dateRange(searchParams) && { startAt: dateRange(searchParams) }),
    ...(sp(searchParams, "q") && { facility: { name: { contains: sp(searchParams, "q")!, mode: "insensitive" } } }),
  };

  const [yearRows, rows, total, filteredSum, settlements, sales, revenue, account] = await Promise.all([
    prisma.booking.findMany({ where: { sellerId: user.id, status: { in: [...paidStatuses] }, startAt: { gte: yearStart } }, select: { startAt: true, endAt: true, totalPrice: true, facility: { select: { name: true } } } }),
    tab === "usage" ? prisma.booking.findMany({ where, orderBy: { startAt: "desc" }, skip, take, include: { facility: { select: { name: true, basePrice: true } } } }) : Promise.resolve([]),
    prisma.booking.count({ where }),
    prisma.booking.aggregate({ where, _sum: { totalPrice: true } }),
    tab === "sales" ? prisma.settlement.findMany({ where: { sellerId: user.id }, orderBy: { periodEnd: "desc" }, include: { facility: { select: { name: true } } } }) : Promise.resolve([]),
    tab === "sales" ? computeSettlement({ sellerId: user.id }).catch(() => ({ orderCount: 0, gross: 0, sellerProfit: 0, facilityAmount: 0 })) : Promise.resolve(null),
    tab === "sales" ? revenueLines({ sellerId: user.id }).catch(() => []) : Promise.resolve([]),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { bankAccount: true } }).catch(() => null),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  const monthly = months.map((m) => ({ label: `${kstParts(m).month}월`, value: yearRows.filter((b) => b.startAt >= m && b.startAt < addMonths(m, 1)).reduce((s, b) => s + b.totalPrice, 0) }));
  const thisMonth = monthly[11].value, lastMonth = monthly[10].value;
  const yearTotal = monthly.reduce((s, m) => s + m.value, 0);
  const hours = yearRows.reduce((s, b) => s + hoursBetween(b.startAt, b.endAt), 0);
  const byFacility = Object.entries(yearRows.reduce<Record<string, number>>((acc, b) => { acc[b.facility.name] = (acc[b.facility.name] ?? 0) + b.totalPrice; return acc; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="정산 내역" description="창고(스튜디오) 이용료 지출과 판매 정산 현황을 확인합니다." />

      <div className="flex gap-1.5">
        {[{ k: "sales", label: "판매 정산", icon: Banknote }, { k: "usage", label: "창고(스튜디오) 이용 내역", icon: Receipt }].map((t) => (
          <Link key={t.k} href={withParams(BASE, {}, { tab: t.k === "sales" ? undefined : t.k })}
            className={cn("flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold", tab === t.k ? "border-navy bg-navy text-white" : "border-[#E5E0D6] bg-white text-slate-600")}>
            <t.icon className="h-4 w-4" />{t.label}
          </Link>
        ))}
      </div>

      {tab === "usage" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="이번 달 이용료" value={formatKRW(thisMonth)} delta={growth(thisMonth, lastMonth)} sub="지난달 대비" icon={Wallet} tone="brand" />
            <Kpi label="최근 12개월" value={formatKRW(yearTotal)} sub={`${yearRows.length}건`} icon={TrendingUp} tone="navy" />
            <Kpi label="이용 시간" value={`${Math.round(hours)}시간`} sub={yearRows.length ? `평균 ${formatKRW(Math.round(yearTotal / Math.max(1, hours)))}/시간` : undefined} icon={CalendarCheck} tone="blue" />
            <Kpi label="조회 기간 합계" value={formatKRW(filteredSum._sum.totalPrice ?? 0)} sub={`${total}건`} icon={Receipt} tone="green" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card><CardHeader><CardTitle className="text-base">월별 이용료 (12개월)</CardTitle></CardHeader><CardContent><BarChart data={monthly} format={(n) => formatKRW(n)} /></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-brand-500" />창고(스튜디오)별 지출</CardTitle></CardHeader>
              <CardContent className="space-y-3">{byFacility.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">데이터가 없습니다.</p> : byFacility.map(([n, v]) => <ProgressRow key={n} label={n} value={v} max={byFacility[0][1]} right={formatKRW(v)} />)}</CardContent></Card>
          </div>
          <FilterBar fields={[{ type: "search", key: "q", placeholder: "창고(스튜디오)명" }, { type: "date", key: "from", label: "이용일 시작" }, { type: "date", key: "to", label: "이용일 끝" }]} />
          {rows.length === 0 ? <EmptyState title="확정된 이용 내역이 없습니다" description="예약이 승인되면 이용료가 여기에 표시됩니다." /> : (
            <>
              <div className="flex justify-end">
                <CsvButton filename="창고이용료" headers={["이용일", "창고(스튜디오)", "이용시간", "시간당", "이용료", "상태"]}
                  rows={rows.map((b) => [formatDateTime(b.startAt), b.facility.name, hoursBetween(b.startAt, b.endAt), b.facility.basePrice, b.totalPrice, BOOKING_STATUS[b.status]?.label])} />
              </div>
              <Table headers={["이용일", "창고(스튜디오)", "이용 시간", "이용료", "상태"]}
                rows={rows.map((b) => [formatDateTime(b.startAt), <span key="n" className="font-semibold">{b.facility.name}</span>, `${hoursBetween(b.startAt, b.endAt)}시간`, <b key="p">{formatKRW(b.totalPrice)}</b>, <Badge key="s" tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge>])} />
              <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="판매 매출" value={formatKRW(sales?.gross ?? 0)} sub={`주문 ${sales?.orderCount ?? 0}건`} icon={TrendingUp} tone="navy" />
            <Kpi label="셀러 수익(예상)" value={formatKRW(sales?.sellerProfit ?? 0)} sub={sales && "platformFee" in sales ? `플랫폼 수수료 ${formatKRW(sales.platformFee)} · 브랜드 대금 ${formatKRW(sales.brandAmount)} 제외` : undefined} icon={Wallet} tone="brand" />
            <Kpi label="정산 대기" value={formatKRW(settlements.filter((s) => s.status !== "PAID").reduce((a, s) => a + s.commissionAmount, 0))} icon={CalendarCheck} tone="blue" />
            <Kpi label="지급 완료" value={formatKRW(settlements.filter((s) => s.status === "PAID").reduce((a, s) => a + s.commissionAmount, 0))} icon={Banknote} tone="green" />
          </div>
          {!account?.bankAccount && !user.id.startsWith("demo-") && (
            <Link href="/seller/settings" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <Banknote className="h-5 w-5" />정산 계좌가 등록되지 않았습니다. 설정에서 정산 계좌를 등록해야 판매 정산금을 받을 수 있습니다.
            </Link>
          )}
          <RevenueTable rows={revenue} perspective="SELLER" />
          {settlements.length === 0 ? <EmptyState title="판매 정산 내역이 없습니다" description="라이브 판매 정산이 생성되면 여기에 표시됩니다." /> : (
            <Table headers={["정산 기간", "창고(스튜디오)", "총 매출", "셀러 수익", "창고 정산금", "상태"]}
              rows={settlements.map((s) => [`${formatDate(s.periodStart)} ~ ${formatDate(s.periodEnd)}`, (s.facility?.name ?? "셀러 공간"), formatKRW(s.grossAmount), <b key="c">{formatKRW(s.commissionAmount)}</b>, formatKRW(s.facilityAmount), <Badge key="s" tone={SETTLE_STATUS[s.status]?.tone}>{SETTLE_STATUS[s.status]?.label}</Badge>])} />
          )}
        </>
      )}
    </div>
  );
}
