import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { computeSettlement } from "@/lib/settlement";
import { formatKRW } from "@/lib/utils";
import { TrendingUp, Building2, BarChart3, Package, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_MONTHLY = [
  { month: "1월", gross: 28_400_000, orders: 142 },
  { month: "2월", gross: 35_200_000, orders: 186 },
  { month: "3월", gross: 42_800_000, orders: 215 },
  { month: "4월", gross: 38_600_000, orders: 194 },
  { month: "5월", gross: 51_300_000, orders: 268 },
  { month: "6월", gross: 47_900_000, orders: 241 },
];

const DUMMY_FACILITIES_ST = [
  { name: "강남 프리미엄 라이브 스튜디오", type: "STUDIO",    orders: 87, gross: 42_150_000, sellerProfit: 33_720_000, facilityAmt:  8_430_000, status: "정산완료" },
  { name: "마포구 대형 물류 창고",          type: "WAREHOUSE", orders: 64, gross: 28_800_000, sellerProfit: 23_040_000, facilityAmt:  5_760_000, status: "정산완료" },
  { name: "성수 인더스트리얼 스튜디오",     type: "STUDIO",    orders: 52, gross: 21_600_000, sellerProfit: 17_280_000, facilityAmt:  4_320_000, status: "정산대기" },
  { name: "인천 냉장-냉동 전문 창고",       type: "WAREHOUSE", orders: 38, gross: 15_200_000, sellerProfit: 12_160_000, facilityAmt:  3_040_000, status: "정산완료" },
  { name: "판교 IT 테크 스튜디오",          type: "STUDIO",    orders: 29, gross: 12_450_000, sellerProfit:  9_960_000, facilityAmt:  2_490_000, status: "정산완료" },
];

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default async function AdminSettlements() {
  await requireRole(["SUPER_ADMIN"]);

  let st = { gross: 0, sellerProfit: 0, facilityAmount: 0, orderCount: 0 };
  try {
    st = await computeSettlement({});
  } catch { /* DB not available */ }

  if (st.gross === 0) {
    st = { gross: 120_150_000, sellerProfit: 96_120_000, facilityAmount: 24_030_000, orderCount: 270 };
  }

  const maxGross = Math.max(...DUMMY_MONTHLY.map((m) => m.gross));

  return (
    <div className="space-y-5">
      <PageHeader title="전체 정산 현황" description="시설별, 월별 정산 현황을 확인합니다." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="총 매출"      value={formatKRW(st.gross)}          sub="누적"              icon={TrendingUp}   />
        <StatCard label="셀러 정산금"  value={formatKRW(st.sellerProfit)}   sub="80%"               icon={Package}      />
        <StatCard label="시설 정산금"  value={formatKRW(st.facilityAmount)} sub="20%"               icon={Building2}    />
        <StatCard label="총 주문"      value={`${st.orderCount}건`}         sub="정산 대상"         icon={BarChart3}    />
      </div>

      {/* 월별 매출 바 차트 */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-bold text-navy mb-4">월별 전체 매출 추이</h3>
          <div className="flex items-end gap-2 h-32 mb-2">
            {DUMMY_MONTHLY.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{fmtShort(m.gross)}</span>
                <div
                  className="w-full bg-brand-500 rounded-t-sm hover:bg-brand-600 transition"
                  style={{ height: `${Math.max(8, (m.gross / maxGross) * 100)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 시설별 정산 테이블 */}
      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <h3 className="font-bold text-navy mb-4">시설별 정산 내역</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">시설명</th>
                <th className="text-center py-2 text-xs text-muted-foreground font-medium">주문</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">총 매출</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">셀러 정산</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">시설 정산</th>
                <th className="text-center py-2 text-xs text-muted-foreground font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {DUMMY_FACILITIES_ST.map((f) => (
                <tr key={f.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-navy text-xs">{f.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center text-xs">{f.orders}건</td>
                  <td className="py-3 text-right text-xs font-semibold">{formatKRW(f.gross)}</td>
                  <td className="py-3 text-right text-xs text-brand-600 font-semibold">{formatKRW(f.sellerProfit)}</td>
                  <td className="py-3 text-right text-xs text-emerald-600 font-semibold">{formatKRW(f.facilityAmt)}</td>
                  <td className="py-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.status === "정산완료" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {f.status === "정산완료"
                        ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 inline" />{f.status}</span>
                        : <span className="flex items-center gap-1"><Clock className="h-3 w-3 inline" />{f.status}</span>
                      }
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
