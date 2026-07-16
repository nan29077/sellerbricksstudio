import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computeSettlement } from "@/lib/settlement";
import { formatKRW } from "@/lib/utils";
import { TrendingUp, CalendarCheck, Banknote, CheckCircle2, Clock, Info, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_MONTHLY_SELLER = [
  { month: "1월", revenue: 1_240_000 }, { month: "2월", revenue: 1_840_000 },
  { month: "3월", revenue: 2_420_000 }, { month: "4월", revenue: 2_180_000 },
  { month: "5월", revenue: 3_120_000 }, { month: "6월", revenue: 2_890_000 },
];

const DUMMY_SETTLEMENTS = [
  { id:"s1", session:"뷰티 신상 여름 컬렉션",  facility:"강남 프리미엄 라이브 스튜디오", date:"2026-06-20", gross:1_245_000, commission:249_000, sellerNet:996_000,   status:"정산대기" },
  { id:"s2", session:"패션 봄 신상 라이브",     facility:"성수 인더스트리얼 스튜디오",    date:"2026-06-10", gross:980_000,   commission:196_000, sellerNet:784_000,   status:"정산완료" },
  { id:"s3", session:"식품 특가전 라이브",       facility:"마포구 대형 물류 창고",         date:"2026-05-28", gross:1_560_000, commission:312_000, sellerNet:1_248_000, status:"정산완료" },
  { id:"s4", session:"뷰티 케어 스페셜 라이브", facility:"강남 프리미엄 라이브 스튜디오", date:"2026-05-15", gross:820_000,   commission:164_000, sellerNet:656_000,   status:"정산완료" },
  { id:"s5", session:"여름 신상 패션쇼",         facility:"판교 IT 테크 스튜디오",         date:"2026-04-30", gross:670_000,   commission:134_000, sellerNet:536_000,   status:"정산완료" },
];

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default async function SellerSettlements() {
  const user = await requireRole(["SELLER"]);

  let st = { gross: 0, sellerProfit: 0, orderCount: 0 };
  try {
    st = await computeSettlement({ sellerId: user.id });
  } catch { /* DB not available */ }

  if (st.gross === 0) {
    st = { gross: 17_100_000, sellerProfit: 13_680_000, orderCount: 87 };
  }

  const maxRevenue = Math.max(...DUMMY_MONTHLY_SELLER.map((m) => m.revenue));
  const nextPayout = new Date("2026-07-05T00:00:00+09:00");
  const payoutMonth = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", month: "numeric" }).format(nextPayout));
  const payoutDay = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", day: "numeric" }).format(nextPayout));

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="정산 내역" description="방송별 매출, 수수료, 수령 금액을 확인하세요." />

      {/* 다음 정산 안내 배너 */}
      <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 flex items-center gap-3">
        <CalendarCheck className="h-5 w-5 text-brand-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-800">
            다음 정산일: {payoutMonth}월 {payoutDay}일
          </p>
          <p className="text-xs text-brand-600">이번 달 정산 대기 금액 {formatKRW(st.sellerProfit)}이 지급됩니다.</p>
        </div>
        <ArrowRight className="h-4 w-4 text-brand-500 shrink-0" />
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="총 매출"      value={formatKRW(st.gross)}        sub="방송 합산"    icon={TrendingUp}   />
        <StatCard label="셀러 수령"    value={formatKRW(st.sellerProfit)} sub="수수료 후"    icon={Banknote}     />
        <StatCard label="총 주문"      value={`${st.orderCount}건`}       sub="정산 대상"    icon={CalendarCheck} />
      </div>

      {/* 월별 수익 바 차트 */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-bold text-navy mb-4">월별 셀러 수익 추이</h3>
          <div className="flex items-end gap-2 h-28 mb-2">
            {DUMMY_MONTHLY_SELLER.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{fmtShort(m.revenue)}</span>
                <div
                  className="w-full bg-brand-500 rounded-t-sm hover:bg-brand-600 transition"
                  style={{ height: `${Math.max(8, (m.revenue / maxRevenue) * 100)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 정산 내역 테이블 */}
      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <h3 className="font-bold text-navy mb-4">방송별 정산 내역</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">방송 세션</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">시설</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">총 매출</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">수수료</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">수령액</th>
                <th className="text-center py-2 text-xs text-muted-foreground font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {DUMMY_SETTLEMENTS.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                  <td className="py-3">
                    <p className="font-medium text-navy text-xs">{s.session}</p>
                    <p className="text-[10px] text-muted-foreground">{s.date}</p>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">{s.facility}</td>
                  <td className="py-3 text-right text-xs">{formatKRW(s.gross)}</td>
                  <td className="py-3 text-right text-xs text-red-500">-{formatKRW(s.commission)}</td>
                  <td className="py-3 text-right text-xs font-bold text-brand-600">{formatKRW(s.sellerNet)}</td>
                  <td className="py-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 justify-center ${s.status === "정산완료" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {s.status === "정산완료"
                        ? <><CheckCircle2 className="h-3 w-3" />{s.status}</>
                        : <><Clock className="h-3 w-3" />{s.status}</>
                      }
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 안내 카드 */}
      <Card className="bg-muted/40">
        <CardContent className="pt-4 pb-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>셀러브릭스 수수료는 총 매출의 20%입니다.</p>
            <p>정산은 매월 5일에 등록된 계좌로 자동 지급됩니다.</p>
            <p>정산 관련 문의는 고객센터(1588-0000)로 연락해주세요.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
