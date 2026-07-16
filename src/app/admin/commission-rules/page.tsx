import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { ManagerCommissionEditor } from "@/components/manager-commission-editor";
import { formatKRW } from "@/lib/utils";
import { Percent, Building2, Users, TrendingUp, Info } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_MANAGER_COMMISSIONS = [
  { id:"m1", name:"중간관리자 (영업담당)", email:"manager@sellerbricks.kr", facilityCount:3, type:"PERCENT" as const, value:5,      estimatedMonthly: 1_240_000 },
  { id:"m2", name:"영업팀장 (권도현)",    email:"manager2@example.com",    facilityCount:2, type:"PERCENT" as const, value:7,      estimatedMonthly:   980_000 },
  { id:"m3", name:"지역매니저 (이준호)",  email:"manager3@example.com",    facilityCount:2, type:"FIXED"   as const, value:50_000, estimatedMonthly:   850_000 },
];

const DUMMY_PRODUCT_COMMISSIONS = [
  { facility:"강남 프리미엄 라이브 스튜디오", product:"뷰티 세럼 A",    price: 45_000, type:"PERCENT", value:20 },
  { facility:"강남 프리미엄 라이브 스튜디오", product:"선크림 SPF50+",  price: 28_000, type:"PERCENT", value:20 },
  { facility:"마포구 대형 물류 창고",          product:"홍삼 진액 세트", price: 89_000, type:"PERCENT", value:15 },
  { facility:"성수 인더스트리얼 스튜디오",     product:"패션 티셔츠",    price: 35_000, type:"PERCENT", value:18 },
];

export default async function AdminCommissionRules() {
  await requireRole(["SUPER_ADMIN"]);

  let managers = DUMMY_MANAGER_COMMISSIONS;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch { /* DB 없음 */ }

  const totalManagers = managers.length;
  const totalFacilities = managers.reduce((s, m) => s + m.facilityCount, 0);
  const avgCommission = Math.round(managers.reduce((s, m) => s + m.value, 0) / managers.length);
  const totalMonthly = managers.reduce((s, m) => s + m.estimatedMonthly, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="수수료 정책" description="중간관리자 및 상품 수수료 규칙을 관리합니다." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="관리자 수"       value={`${totalManagers}명`}          sub="활성"    icon={Users}     />
        <StatCard label="담당 시설"        value={`${totalFacilities}개`}        sub="총합"    icon={Building2} />
        <StatCard label="평균 수수료율"    value={`${avgCommission}%`}           sub="관리자"  icon={Percent}   />
        <StatCard label="월 수수료 합계"   value={formatKRW(totalMonthly)}       sub="예상"    icon={TrendingUp} />
      </div>

      {/* 관리자 수수료 */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-bold text-navy">중간관리자 수수료 규칙</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              시설 총 매출 기준으로 자동 계산됩니다
            </div>
          </div>
          <div className="space-y-4">
            {managers.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-navy">{m.name}</p>
                    <p className="text-xs text-muted-foreground mb-1">{m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      담당 시설 {m.facilityCount}개 · 예상 월 수수료 {formatKRW(m.estimatedMonthly)}
                    </p>
                  </div>
                  <div className="shrink-0 w-full sm:w-56">
                    <ManagerCommissionEditor
                      managerId={m.id}
                      type={m.type}
                      value={m.value}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 상품 수수료 */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-bold text-navy mb-4">시설 상품 수수료 현황</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">시설</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">상품</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">판매가</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">수수료</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">셀러 수령</th>
                </tr>
              </thead>
              <tbody>
                {DUMMY_PRODUCT_COMMISSIONS.map((pc, i) => {
                  const sellerAmt = pc.type === "PERCENT"
                    ? Math.round(pc.price * (1 - pc.value / 100))
                    : pc.price - pc.value;
                  return (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                      <td className="py-3 text-xs text-muted-foreground">{pc.facility}</td>
                      <td className="py-3 text-xs font-medium text-navy">{pc.product}</td>
                      <td className="py-3 text-right text-xs">{formatKRW(pc.price)}</td>
                      <td className="py-3 text-center">
                        <span className="text-xs font-semibold text-brand-600">
                          {pc.type === "PERCENT" ? `${pc.value}%` : formatKRW(pc.value)}
                        </span>
                      </td>
                      <td className="py-3 text-right text-xs font-semibold text-emerald-600">{formatKRW(sellerAmt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
