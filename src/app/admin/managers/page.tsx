import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManagerCommissionEditor } from "@/components/manager-commission-editor";
import { formatKRW } from "@/lib/utils";
import { Users, Building2, DollarSign, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_MANAGERS = [
  {
    id: "m1", name: "중간관리자 (영업담당)", email: "manager@sellerbricks.kr",
    facilityCount: 3, commissionType: "PERCENT", commissionValue: 5,
    monthlyIncome: 1_240_000, totalIncome: 4_850_000,
    facilities: ["강남 프리미엄 라이브 스튜디오", "성수 인더스트리얼 스튜디오", "판교 IT 테크 스튜디오"],
  },
  {
    id: "m2", name: "영업팀장 (권도현)", email: "manager2@example.com",
    facilityCount: 2, commissionType: "PERCENT", commissionValue: 7,
    monthlyIncome: 980_000, totalIncome: 2_940_000,
    facilities: ["마포구 대형 물류 창고", "인천 냉장-냉동 전문 창고"],
  },
  {
    id: "m3", name: "지역매니저 (이준호)", email: "manager3@example.com",
    facilityCount: 2, commissionType: "FIXED", commissionValue: 50000,
    monthlyIncome: 850_000, totalIncome: 1_700_000,
    facilities: ["부산 해운대 뷰 라이브룸", "수원 영통 물류 센터"],
  },
];

export default async function AdminManagers() {
  await requireRole(["SUPER_ADMIN"]);

  let managers = DUMMY_MANAGERS;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    // DB 없음 - dummy 사용
  }

  const totalManagers = managers.length;
  const totalFacilities = managers.reduce((s, m) => s + m.facilityCount, 0);
  const totalMonthlyIncome = managers.reduce((s, m) => s + m.monthlyIncome, 0);
  const totalCumulative = managers.reduce((s, m) => s + m.totalIncome, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="중간관리자 관리" description="담당 시설 배정과 수수료 규칙을 설정합니다." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="관리자 수"       value={`${totalManagers}명`}          sub="활성"      icon={Users}      />
        <StatCard label="담당 시설"        value={`${totalFacilities}개`}        sub="총합"      icon={Building2}  />
        <StatCard label="이번 달 수수료"   value={formatKRW(totalMonthlyIncome)} sub="합산"      icon={DollarSign} />
        <StatCard label="누적 수수료"      value={formatKRW(totalCumulative)}    sub="전체"      icon={TrendingUp} />
      </div>

      <div className="space-y-4">
        {managers.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-navy">{m.name}</p>
                    <Badge tone="blue">{m.commissionType === "PERCENT" ? `${m.commissionValue}%` : formatKRW(m.commissionValue) + "/건"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{m.email}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {m.facilities.map((f) => (
                      <span key={f} className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-100">{f}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">담당 시설</p>
                      <p className="font-bold text-navy">{m.facilityCount}개</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">이번 달</p>
                      <p className="font-bold text-emerald-600">{formatKRW(m.monthlyIncome)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">누적 수익</p>
                      <p className="font-bold text-navy">{formatKRW(m.totalIncome)}</p>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 w-full sm:w-64">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">수수료 규칙 수정</p>
                  <ManagerCommissionEditor
                    managerId={m.id}
                    type={m.commissionType}
                    value={m.commissionValue}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
