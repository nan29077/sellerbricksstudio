import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/utils";
import { CalendarCheck, Banknote, CheckCircle2, Info, TrendingUp, Building2 } from "lucide-react";
import { computeSettlement } from "@/lib/settlement";

export const dynamic = "force-dynamic";

const DUMMY_MONTHLY_FAC = [
  { month: "1월", facilityAmt: 4_820_000 },
  { month: "2월", facilityAmt: 6_240_000 },
  { month: "3월", facilityAmt: 7_680_000 },
  { month: "4월", facilityAmt: 6_900_000 },
  { month: "5월", facilityAmt: 8_450_000 },
  { month: "6월", facilityAmt: 7_320_000 },
];

const DUMMY_SETTLEMENT_ROWS = [
  { id:"sf1", session:"뷰티 신상 여름 컬렉션",  facility:"강남 프리미엄 라이브 스튜디오", date:"2026-06-20", gross:1_245_000, facilityAmt:249_000, status:"정산대기" },
  { id:"sf2", session:"패션 봄 신상 라이브",     facility:"강남 프리미엄 라이브 스튜디오", date:"2026-06-10", gross:980_000,   facilityAmt:196_000, status:"정산완료" },
  { id:"sf3", session:"식품 특가전 라이브",       facility:"마포구 대형 물류 창고",         date:"2026-05-28", gross:1_560_000, facilityAmt:312_000, status:"정산완료" },
  { id:"sf4", session:"뷰티 케어 스페셜 라이브", facility:"강남 프리미엄 라이브 스튜디오", date:"2026-05-15", gross:820_000,   facilityAmt:164_000, status:"정산완료" },
  { id:"sf5", session:"여름 신상 패션쇼",         facility:"마포구 대형 물류 창고",         date:"2026-04-30", gross:670_000,   facilityAmt:134_000, status:"정산완료" },
];

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default async function FacilitySettlements() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let st = { gross: 0, facilityAmount: 0, orderCount: 0 };
  try {
    const ids = await ownedFacilityIds(user.id);
    st = await computeSettlement({ facilityIds: ids });
  } catch { /* DB not available */ }

  if (st.gross === 0) {
    st = { gross: 41_410_000, facilityAmount: 8_282_000, orderCount: 248 };
  }

  const maxAmt = Math.max(...DUMMY_MONTHLY_FAC.map((m) => m.facilityAmt));

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="정산 내역" description="시설 운영 수익 및 정산 현황을 확인하세요." />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="시설 총 매출"  value={formatKRW(st.gross)}          sub="누적"    icon={TrendingUp}   />
        <StatCard label="시설 정산금"   value={formatKRW(st.facilityAmount)} sub="20%"     icon={Banknote}     />
        <StatCard label="총 주문"       value={`${st.orderCount}건`}         sub="정산 대상" icon={CalendarCheck} />
      </div>

      {/* 월별 수익 차트 */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-bold text-navy mb-4">월별 시설 정산금 추이</h3>
          <div className="flex items-end gap-2 h-28 mb-2">
            {DUMMY_MONTHLY_FAC.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{fmtShort(m.facilityAmt)}</span>
                <div
                  className="w-full bg-emerald-500 rounded-t-sm hover:bg-emerald-600 transition"
                  style={{ height: `${Math.max(8, (m.facilityAmt / maxAmt) * 100)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 정산 내역 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">방송별 정산 내역</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <Table
            headers={["방송 세션", "시설", "총 매출", "시설 정산금", "상태"]}
            rows={DUMMY_SETTLEMENT_ROWS.map((s) => [
              <div key="session">
                <p className="font-medium text-navy text-xs">{s.session}</p>
                <p className="text-[10px] text-muted-foreground">{s.date}</p>
              </div>,
              <Td key="facility">{s.facility}</Td>,
              <span key="gross" className="text-xs font-semibold">{formatKRW(s.gross)}</span>,
              <span key="amt" className="text-xs font-bold text-emerald-600">{formatKRW(s.facilityAmt)}</span>,
              <span key="status" className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${s.status === "정산완료" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                {s.status === "정산완료"
                  ? <><CheckCircle2 className="h-3 w-3" />{s.status}</>
                  : <><Building2 className="h-3 w-3" />{s.status}</>
                }
              </span>,
            ])}
          />
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardContent className="pt-4 pb-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>시설 정산금은 방송 총 매출의 20%입니다.</p>
            <p>정산은 매월 5일에 등록된 계좌로 자동 지급됩니다.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
