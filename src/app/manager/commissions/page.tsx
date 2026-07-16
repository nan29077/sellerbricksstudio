import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/utils";
import { Percent, CalendarCheck, Info, Building2, TrendingUp, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_COMMISSION_HISTORY = [
  { month: "2026-06", facilityGross: 25_450_000, rate: "5%", income: 1_272_500, status: "정산대기" },
  { month: "2026-05", facilityGross: 22_800_000, rate: "5%", income: 1_140_000, status: "정산완료" },
  { month: "2026-04", facilityGross: 19_600_000, rate: "5%", income:   980_000, status: "정산완료" },
  { month: "2026-03", facilityGross: 24_100_000, rate: "5%", income: 1_205_000, status: "정산완료" },
  { month: "2026-02", facilityGross: 18_400_000, rate: "5%", income:   920_000, status: "정산완료" },
  { month: "2026-01", facilityGross: 14_200_000, rate: "5%", income:   710_000, status: "정산완료" },
];

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default async function ManagerCommissions() {
  const user = await requireRole(["MANAGER"]);

  let rule: any = null;
  try {
    rule = await prisma.managerCommissionRule.findUnique({ where: { managerId: user.id } });
  } catch { /* DB not available */ }

  rule = rule ?? { commissionType: "PERCENT", commissionValue: 5 };

  const commissionLabel = rule.commissionType === "PERCENT"
    ? `${rule.commissionValue}%`
    : formatKRW(rule.commissionValue) + "/건";

  const totalIncome  = DUMMY_COMMISSION_HISTORY.reduce((s, m) => s + m.income, 0);
  const thisMonth    = DUMMY_COMMISSION_HISTORY[0].income;
  const pendingCount = DUMMY_COMMISSION_HISTORY.filter((m) => m.status === "정산대기").length;
  const maxIncome    = Math.max(...DUMMY_COMMISSION_HISTORY.map((m) => m.income));

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="수수료 내역" description="내 수수료율과 월별 수익 현황을 확인하세요." />

      {/* 수수료율 배너 */}
      <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 flex items-center gap-3">
        <Percent className="h-5 w-5 text-purple-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-purple-800">내 수수료율: {commissionLabel}</p>
          <p className="text-xs text-purple-600">담당 시설 총 매출 기준으로 매월 자동 계산됩니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="이번 달 수수료"  value={formatKRW(thisMonth)}   sub="정산 대기"  icon={CalendarCheck} />
        <StatCard label="누적 수수료"     value={formatKRW(totalIncome)} sub="6개월 합계" icon={TrendingUp}    />
        <StatCard label="정산 대기"       value={`${pendingCount}건`}    sub="미지급"     icon={Banknote}      />
      </div>

      {/* 월별 수수료 차트 */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-bold text-navy mb-4">월별 수수료 수익</h3>
          <div className="flex items-end gap-2 h-28 mb-2">
            {[...DUMMY_COMMISSION_HISTORY].reverse().map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{fmtShort(m.income)}</span>
                <div
                  className="w-full bg-purple-500 rounded-t-sm hover:bg-purple-600 transition"
                  style={{ height: `${Math.max(8, (m.income / maxIncome) * 100)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{m.month.slice(5)}월</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 월별 상세 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">월별 수수료 상세</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <Table
            headers={["월", "시설 총 매출", "수수료율", "수수료 수익", "상태"]}
            rows={DUMMY_COMMISSION_HISTORY.map((m) => [
              <span key="month" className="font-semibold text-navy text-sm">{m.month}</span>,
              <span key="gross" className="text-xs">{formatKRW(m.facilityGross)}</span>,
              <Td key="rate">{m.rate}</Td>,
              <span key="income" className="font-bold text-purple-600">{formatKRW(m.income)}</span>,
              <Badge key="status" tone={m.status === "정산완료" ? "green" : "yellow"}>{m.status}</Badge>,
            ])}
          />
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardContent className="pt-4 pb-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>수수료 금액은 담당 시설의 방송 총 매출 기준으로 계산됩니다.</p>
            <p>정산은 매월 5일에 자동 지급됩니다.</p>
            <p>수수료율 변경은 최고관리자에게 문의하세요.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
