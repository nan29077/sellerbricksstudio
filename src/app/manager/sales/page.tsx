import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatKRW, formatDate } from "@/lib/utils";
import { TrendingUp, Percent, Building2, BarChart2 } from "lucide-react";
import { computeSettlement } from "@/lib/settlement";

export const dynamic = "force-dynamic";

const DUMMY_MONTHLY_MGR = [
  { month: "1월", commission: 620_000 },
  { month: "2월", commission: 840_000 },
  { month: "3월", commission: 980_000 },
  { month: "4월", commission: 870_000 },
  { month: "5월", commission: 1_240_000 },
  { month: "6월", commission: 1_180_000 },
];

const DUMMY_FACILITY_SALES = [
  { rank:1, name:"강남 프리미엄 라이브 스튜디오", region:"서울", type:"STUDIO",    orders:87, gross:42_150_000, commission:2_107_500, growth:"+12%" },
  { rank:2, name:"성수 인더스트리얼 스튜디오",    region:"서울", type:"STUDIO",    orders:52, gross:21_600_000, commission:1_080_000, growth:"+8%"  },
  { rank:3, name:"판교 IT 테크 스튜디오",         region:"경기", type:"STUDIO",    orders:29, gross:12_450_000, commission:  622_500, growth:"+5%"  },
];

const DUMMY_RECENT_ORDERS = [
  { id:"o1", orderNo:"ORD-20260620-001", facility:"강남 프리미엄 라이브 스튜디오", seller:"박지현", amount: 89_000, commission: 4_450, date:"2026-06-20" },
  { id:"o2", orderNo:"ORD-20260620-002", facility:"강남 프리미엄 라이브 스튜디오", seller:"홍길동", amount:145_000, commission: 7_250, date:"2026-06-20" },
  { id:"o3", orderNo:"ORD-20260619-001", facility:"성수 인더스트리얼 스튜디오",    seller:"김미래", amount: 56_000, commission: 2_800, date:"2026-06-19" },
  { id:"o4", orderNo:"ORD-20260618-001", facility:"판교 IT 테크 스튜디오",         seller:"정유나", amount:210_000, commission:10_500, date:"2026-06-18" },
  { id:"o5", orderNo:"ORD-20260617-001", facility:"강남 프리미엄 라이브 스튜디오", seller:"이수민", amount:320_000, commission:16_000, date:"2026-06-17" },
];

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default async function ManagerSales() {
  const user = await requireRole(["MANAGER"]);

  let st = { gross: 0, orderCount: 0 };
  let rule: any = null;
  try {
    const ids = await managerFacilityIds(user.id);
    [st, rule] = await Promise.all([
      computeSettlement({ facilityIds: ids }),
      prisma.managerCommissionRule.findUnique({ where: { managerId: user.id } }),
    ]);
  } catch { /* DB not available */ }

  if (st.gross === 0) {
    st = { gross: 76_200_000, orderCount: 168 };
    rule = rule ?? { commissionType: "PERCENT", commissionValue: 5 };
  }

  const myIncome = rule
    ? rule.commissionType === "PERCENT"
      ? Math.round(st.gross * rule.commissionValue / 100)
      : rule.commissionValue * st.orderCount
    : 0;

  const commissionLabel = rule
    ? rule.commissionType === "PERCENT" ? `${rule.commissionValue}%` : formatKRW(rule.commissionValue) + "/건"
    : "미설정";

  const maxCommission = Math.max(...DUMMY_MONTHLY_MGR.map((m) => m.commission));
  const totalMonthly  = DUMMY_MONTHLY_MGR.reduce((s, m) => s + m.commission, 0);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="매출 현황" description="담당 시설 매출 및 수수료 수익을 분석합니다." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="시설 총 매출"   value={formatKRW(st.gross)}    sub={`${st.orderCount}건`}   icon={BarChart2}  />
        <StatCard label="내 수수료율"    value={commissionLabel}         sub="설정된 규칙"           icon={Percent}    />
        <StatCard label="내 수수료 수익" value={formatKRW(myIncome)}    sub="누적"                  icon={TrendingUp} />
        <StatCard label="담당 시설"      value={`${DUMMY_FACILITY_SALES.length}개`} sub="운영중"    icon={Building2}  />
      </div>

      {/* 월별 수수료 차트 */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy">월별 수수료 수익 추이</h3>
            <span className="text-xs text-muted-foreground">6개월 합계: {formatKRW(totalMonthly)}</span>
          </div>
          <div className="flex items-end gap-2 h-28 mb-2">
            {DUMMY_MONTHLY_MGR.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{fmtShort(m.commission)}</span>
                <div
                  className="w-full bg-purple-500 rounded-t-sm hover:bg-purple-600 transition"
                  style={{ height: `${Math.max(8, (m.commission / maxCommission) * 100)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 시설별 매출 순위 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시설별 매출 순위</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <Table
            headers={["순위", "시설명", "지역", "주문", "매출", "수수료 수익", "성장"]}
            rows={DUMMY_FACILITY_SALES.map((f) => [
              <span key="rank" className={`text-sm font-extrabold ${f.rank === 1 ? "text-amber-500" : f.rank === 2 ? "text-gray-400" : "text-orange-400"}`}>#{f.rank}</span>,
              <span key="name" className="font-medium text-navy text-sm">{f.name}</span>,
              <Td key="region">{f.region}</Td>,
              <Td key="orders">{f.orders}건</Td>,
              <span key="gross" className="font-semibold text-navy text-sm">{formatKRW(f.gross)}</span>,
              <span key="commission" className="font-bold text-purple-600 text-sm">{formatKRW(f.commission)}</span>,
              <Badge key="growth" tone="green">{f.growth}</Badge>,
            ])}
          />
        </CardContent>
      </Card>

      {/* 최근 주문 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 주문 내역</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <Table
            headers={["주문번호", "시설", "셀러", "금액", "수수료 수익", "날짜"]}
            rows={DUMMY_RECENT_ORDERS.map((o) => [
              <span key="no" className="font-mono text-xs">{o.orderNo}</span>,
              <Td key="facility">{o.facility}</Td>,
              <Td key="seller">{o.seller}</Td>,
              <span key="amount" className="font-semibold text-navy text-sm">{formatKRW(o.amount)}</span>,
              <span key="commission" className="font-bold text-purple-600 text-sm">{formatKRW(o.commission)}</span>,
              <Td key="date">{o.date}</Td>,
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
