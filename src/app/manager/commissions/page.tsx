import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { Kpi, BarChart } from "@/components/list/charts";
import { CsvButton } from "@/components/list/csv-button";
import { calcManagerCommission, managerFeeRows } from "@/lib/manager-commission";
import { formatKRW } from "@/lib/utils";
import { addMonths, kstParts, kstStartOfMonth } from "@/lib/kst";
import { growth } from "@/lib/list";
import { Coins, Percent, TrendingUp, Hourglass, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ManagerCommissions() {
  const user = await requireRole(["MANAGER"]);
  const ids = await managerFacilityIds(user.id);
  const m = kstStartOfMonth(new Date());
  const start = addMonths(m, -11);
  const [rule, completed, upcoming, allTime, fees] = await Promise.all([
    prisma.managerCommissionRule.findUnique({ where: { managerId: user.id } }),
    prisma.booking.findMany({ where: { facilityId: { in: ids }, status: "COMPLETED", startAt: { gte: start } }, select: { startAt: true, totalPrice: true, facility: { select: { id: true, name: true } } } }),
    prisma.booking.aggregate({ where: { facilityId: { in: ids }, status: "APPROVED" }, _sum: { totalPrice: true }, _count: true }),
    prisma.booking.aggregate({ where: { facilityId: { in: ids }, status: "COMPLETED" }, _sum: { totalPrice: true }, _count: true }),
    managerFeeRows(ids), // 배송 완료 주문의 플랫폼 판매 수수료 (정률 수수료 기준)
  ]);
  const feeIn = (from: Date, to: Date, facilityId?: string) => fees.filter((f) => f.at >= from && f.at < to && (!facilityId || f.facilityId === facilityId)).reduce((s, f) => s + f.fee, 0);
  const feeAll = fees.reduce((s, f) => s + f.fee, 0);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(start, i));
  const monthly = months.map((mm) => {
    const r = completed.filter((b) => b.startAt >= mm && b.startAt < addMonths(mm, 1));
    const rev = feeIn(mm, addMonths(mm, 1));
    return { label: `${kstParts(mm).month}월`, key: `${kstParts(mm).year}-${kstParts(mm).month}`, rev, n: r.length, value: calcManagerCommission(rule, rev, r.length) };
  });
  const cur = monthly[11], prev = monthly[10];
  const byFac = new Map<string, { name: string; rev: number; n: number }>();
  for (const b of completed.filter((b) => b.startAt >= m)) {
    const x = byFac.get(b.facility.id) ?? { name: b.facility.name, rev: 0, n: 0 };
    x.n += 1; byFac.set(b.facility.id, x);
  }
  for (const [id, x] of Array.from(byFac)) x.rev = feeIn(m, addMonths(m, 1), id);
  const ruleText = rule ? (rule.commissionType === "PERCENT" ? `판매 수수료의 ${rule.commissionValue}%` : `완료 1건당 ${formatKRW(rule.commissionValue)}`) : "미설정";

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="내 수수료" description="정률은 담당 창고(스튜디오) 방송의 배송 완료 주문에서 발생한 플랫폼 판매 수수료, 정액은 '이용 완료' 예약 건수를 기준으로 계산한 영업 수수료입니다." />
      {!rule && <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><Info className="h-4 w-4" />아직 수수료율이 설정되지 않았습니다. 최고관리자에게 문의하세요.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="이번 달 수수료" value={formatKRW(cur.value)} delta={growth(cur.value, prev.value)} sub={`완료 ${cur.n}건`} icon={Coins} tone="green" />
        <Kpi label="수수료 규칙" value={ruleText} icon={Percent} tone="brand" />
        <Kpi label="예정 수수료" value={formatKRW(calcManagerCommission(rule, 0, upcoming._count))} sub={rule?.commissionType === "PERCENT" ? "정률은 배송 완료 후 확정" : `승인된 예약 ${upcoming._count}건이 완료되면`} icon={Hourglass} tone="blue" />
        <Kpi label="누적 수수료" value={formatKRW(calcManagerCommission(rule, feeAll, allTime._count))} sub={`완료 ${allTime._count}건`} icon={TrendingUp} tone="navy" />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">월별 수수료 (12개월)</CardTitle>
          <CsvButton label="CSV" filename="월별수수료" headers={["월", "완료건수", "플랫폼 판매 수수료", "수수료"]} rows={monthly.map((x) => [x.key, x.n, x.rev, x.value])} /></CardHeader>
        <CardContent><BarChart data={monthly} format={(n) => formatKRW(n)} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">이번 달 창고(스튜디오)별 기여</CardTitle></CardHeader>
        <CardContent>
          {byFac.size === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">이번 달 이용 완료된 예약이 없습니다.</p> : (
            <Table headers={["창고(스튜디오)", "이용 완료", "플랫폼 판매 수수료", "수수료"]}
              rows={Array.from(byFac.values()).sort((a, b) => b.rev - a.rev).map((f) => [<b key="n">{f.name}</b>, `${f.n}건`, formatKRW(f.rev), <span key="c" className="font-bold text-emerald-700">{formatKRW(calcManagerCommission(rule, f.rev, f.n))}</span>])} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
