import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { Kpi, BarChart, ProgressRow } from "@/components/list/charts";
import { CsvButton } from "@/components/list/csv-button";
import { formatKRW } from "@/lib/utils";
import { addMonths, hoursBetween, kstParts, kstStartOfMonth } from "@/lib/kst";
import { growth } from "@/lib/list";
import { Wallet, TrendingUp, CalendarCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ManagerSales() {
  const user = await requireRole(["MANAGER"]);
  const ids = await managerFacilityIds(user.id);
  if (ids.length === 0) return <div><PageHeader title="매출 현황" /><EmptyState title="배정된 창고(스튜디오)가 없습니다" /></div>;
  const m = kstStartOfMonth(new Date());
  const start = addMonths(m, -11);
  const rows = await prisma.booking.findMany({
    where: { facilityId: { in: ids }, status: { in: ["APPROVED", "COMPLETED"] }, startAt: { gte: start, lt: addMonths(m, 1) } },
    select: { startAt: true, endAt: true, totalPrice: true, status: true, sellerId: true, facility: { select: { id: true, name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } },
  });
  const months = Array.from({ length: 12 }, (_, i) => addMonths(start, i));
  const monthly = months.map((mm) => { const r = rows.filter((b) => b.startAt >= mm && b.startAt < addMonths(mm, 1)); return { label: `${kstParts(mm).month}월`, value: r.reduce((s, b) => s + b.totalPrice, 0), n: r.length }; });
  const cur = monthly[11], prev = monthly[10];
  const yearTotal = monthly.reduce((s, x) => s + x.value, 0);

  const byFac = new Map<string, { name: string; rev: number; n: number; h: number; cur: number }>();
  for (const b of rows) {
    const x = byFac.get(b.facility.id) ?? { name: b.facility.name, rev: 0, n: 0, h: 0, cur: 0 };
    x.rev += b.totalPrice; x.n += 1; x.h += hoursBetween(b.startAt, b.endAt); if (b.startAt >= m) x.cur += b.totalPrice;
    byFac.set(b.facility.id, x);
  }
  const facRows = Array.from(byFac.values()).sort((a, b) => b.rev - a.rev);
  const bySeller = new Map<string, { name: string; rev: number; n: number }>();
  for (const b of rows) {
    const x = bySeller.get(b.sellerId) ?? { name: b.seller.profile?.name ?? b.seller.email, rev: 0, n: 0 };
    x.rev += b.totalPrice; x.n += 1; bySeller.set(b.sellerId, x);
  }
  const topSellers = Array.from(bySeller.values()).sort((a, b) => b.rev - a.rev).slice(0, 8);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="매출 현황" description="담당 창고(스튜디오)의 확정 예약(승인·이용 완료) 이용료 기준 매출입니다." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="이번 달 매출" value={formatKRW(cur.value)} delta={growth(cur.value, prev.value)} sub="지난달 대비" icon={Wallet} tone="green" />
        <Kpi label="이번 달 예약" value={`${cur.n}건`} delta={growth(cur.n, prev.n)} icon={CalendarCheck} tone="blue" />
        <Kpi label="최근 12개월" value={formatKRW(yearTotal)} sub={`${rows.length}건`} icon={TrendingUp} tone="navy" />
        <Kpi label="이용 셀러" value={`${bySeller.size}명`} sub={`재이용 ${Array.from(bySeller.values()).filter((s) => s.n > 1).length}명`} icon={Users} tone="brand" />
      </div>
      <Card><CardHeader><CardTitle className="text-base">월별 매출 (12개월)</CardTitle></CardHeader><CardContent><BarChart data={monthly} format={(n) => formatKRW(n)} /></CardContent></Card>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">창고(스튜디오)별 실적</CardTitle>
            <CsvButton label="CSV" filename="담당창고매출" headers={["창고(스튜디오)", "12개월 매출", "건수", "이용시간", "이번 달"]} rows={facRows.map((f) => [f.name, f.rev, f.n, Math.round(f.h), f.cur])} /></CardHeader>
          <CardContent>
            {facRows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">데이터가 없습니다.</p> : (
              <Table headers={["창고(스튜디오)", "12개월", "건수", "시간", "이번 달"]} rows={facRows.map((f) => [<b key="n">{f.name}</b>, formatKRW(f.rev), `${f.n}건`, `${Math.round(f.h)}h`, formatKRW(f.cur)])} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">주요 셀러 (12개월)</CardTitle></CardHeader>
          <CardContent className="space-y-2">{topSellers.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">데이터가 없습니다.</p> : topSellers.map((s) => <ProgressRow key={s.name} label={s.name} value={s.rev} max={topSellers[0].rev} right={`${formatKRW(s.rev)} · ${s.n}건`} />)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
