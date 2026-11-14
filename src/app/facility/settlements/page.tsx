import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { operableFacilityIds } from "@/lib/facility-owner";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { Kpi, BarChart } from "@/components/list/charts";
import { CsvButton } from "@/components/list/csv-button";
import { revenueLines, splitOrder, SETTLEMENT_ORDER_INCLUDE } from "@/lib/settlement";
import { getPolicy } from "@/lib/policy";
import { RevenueTable } from "@/components/settlement/revenue-table";
import { formatDate, formatKRW } from "@/lib/utils";
import { addMonths, kstParts, kstStartOfMonth } from "@/lib/kst";
import { growth } from "@/lib/list";
import { FACILITY_OPERATION_LABEL, SETTLEMENT_STATUS } from "@/lib/status";
import { Banknote, Building2, CheckCircle2, TrendingUp, Info, Landmark } from "lucide-react";

export const dynamic = "force-dynamic";

// 창고 매출 — 창고 이용료는 없다(무료). 창고(스튜디오) 방송에서 팔린 상품의 '창고 몫'을 보여 준다.
//  - 직영: 창고 몫 = 본사 수입 (지급 없음)
//  - 제휴: 창고 몫을 판매 정산서로 제휴 창고 계좌에 지급
export default async function FacilityRevenue() {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  const ids = await operableFacilityIds(user);
  const monthStart = kstStartOfMonth(new Date());
  const yearStart = addMonths(monthStart, -11);
  const policy = await getPolicy();

  const [facilities, orders, settlements, revenue] = await Promise.all([
    prisma.facility.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, operationType: true, bankAccount: true, partnerName: true } }),
    prisma.order.findMany({
      where: { facilityId: { in: ids }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] }, createdAt: { gte: yearStart } },
      select: { id: true, facilityId: true, createdAt: true, shippingFee: true, refundedAmount: true, discountAmount: true, totalAmount: true, liveSessionId: true, ...SETTLEMENT_ORDER_INCLUDE },
    }).catch(() => []),
    prisma.settlement.findMany({
      where: { facilityId: { in: ids } }, orderBy: { periodEnd: "desc" }, take: 50,
      include: { facility: { select: { name: true, operationType: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } },
    }).catch(() => []),
    revenueLines({ facilityIds: ids }).catch(() => []),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  const byFacility = new Map<string, { gross: number; facility: number; month: number }>();
  const monthly = months.map((m) => ({ label: `${kstParts(m).month}월`, value: 0 }));
  for (const o of orders) {
    let r: ReturnType<typeof splitOrder>;
    try { r = splitOrder(o as Parameters<typeof splitOrder>[0], policy); } catch { continue; }
    const idx = months.findIndex((m, i) => o.createdAt >= m && (i === 11 || o.createdAt < months[i + 1]));
    if (idx >= 0) monthly[idx].value += r.facility;
    const cur = byFacility.get(o.facilityId!) ?? { gross: 0, facility: 0, month: 0 };
    cur.gross += r.gross; cur.facility += r.facility;
    if (o.createdAt >= monthStart) cur.month += r.facility;
    byFacility.set(o.facilityId!, cur);
  }
  const opOf = new Map(facilities.map((f) => [f.id, f.operationType]));
  const sum = (pred: (id: string) => boolean) => Array.from(byFacility.entries()).filter(([id]) => pred(id)).reduce((s, [, v]) => s + v.facility, 0);
  const directTotal = sum((id) => opOf.get(id) !== "PARTNER");
  const partnerTotal = sum((id) => opOf.get(id) === "PARTNER");
  const partnerWaiting = settlements.filter((s) => s.facility?.operationType === "PARTNER" && s.status !== "PAID").reduce((a, s) => a + s.facilityAmount, 0);
  const partnerPaid = settlements.filter((s) => s.facility?.operationType === "PARTNER" && s.status === "PAID").reduce((a, s) => a + s.facilityAmount, 0);
  const noBank = facilities.filter((f) => f.operationType === "PARTNER" && !f.bankAccount);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="창고 매출" description="창고(스튜디오) 방송에서 팔린 상품의 창고 몫입니다. 창고 이용료는 없습니다. 직영 창고의 몫은 본사 수입, 제휴 창고의 몫은 판매 정산으로 지급합니다." />

      {noBank.length > 0 && (
        <Link href="/facility/profile" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <Landmark className="h-5 w-5 shrink-0" />지급 계좌가 없는 제휴 창고가 있습니다: {noBank.map((f) => f.name).join(", ")} — 정보 · 편집에서 등록하세요.
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="이번 달 창고 몫" value={formatKRW(monthly[11].value)} delta={growth(monthly[11].value, monthly[10].value)} sub="지난달 대비" icon={TrendingUp} tone="navy" />
        <Kpi label="직영 · 본사 수입 (12개월)" value={formatKRW(directTotal)} icon={Building2} tone="brand" />
        <Kpi label="제휴 · 지급 대기" value={formatKRW(partnerWaiting)} sub={`제휴 창고 몫 12개월 ${formatKRW(partnerTotal)}`} icon={Banknote} tone="blue" />
        <Kpi label="제휴 · 지급 완료" value={formatKRW(partnerPaid)} icon={CheckCircle2} tone="green" />
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-[#E9E5DC] bg-white px-4 py-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p>구매자 결제는 플랫폼이 받고, 판매 수수료 · 브랜드 공급대금 · 셀러 몫을 뺀 금액이 창고 몫입니다. 제휴 창고 몫은 최고관리자가 <b className="text-navy">판매 · 브랜드 정산</b>에서 정산서를 만들어 지급합니다.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">창고별 매출 (12개월)</CardTitle>
          <CsvButton label="CSV" filename="창고매출" headers={["창고(스튜디오)", "운영 형태", "판매 매출", "창고 몫", "이번 달 창고 몫"]}
            rows={facilities.map((f) => { const v = byFacility.get(f.id); return [f.name, FACILITY_OPERATION_LABEL[f.operationType], v?.gross ?? 0, v?.facility ?? 0, v?.month ?? 0]; })} />
        </CardHeader>
        <CardContent>
          {facilities.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">운영하는 창고(스튜디오)가 없습니다.</p> : (
            <Table headers={["창고(스튜디오)", "운영 형태", "판매 매출", "창고 몫", "이번 달"]}
              rows={facilities.map((f) => {
                const v = byFacility.get(f.id);
                return [f.name, <Badge key="o" tone={f.operationType === "PARTNER" ? "purple" : "navy"}>{FACILITY_OPERATION_LABEL[f.operationType]}{f.partnerName ? ` · ${f.partnerName}` : ""}</Badge>, formatKRW(v?.gross ?? 0), <b key="f">{formatKRW(v?.facility ?? 0)}</b>, formatKRW(v?.month ?? 0)];
              })} />
          )}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base">월별 창고 몫 (12개월)</CardTitle></CardHeader><CardContent><BarChart data={monthly} format={(n) => formatKRW(n)} /></CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-base">판매 정산서</CardTitle>
          <p className="text-xs text-muted-foreground">배송 완료된 주문을 기준으로 최고관리자가 만든 정산서입니다. 제휴 창고는 &lsquo;창고 몫&rsquo;이 지급액입니다.</p></CardHeader>
        <CardContent>
          {settlements.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">아직 판매 정산서가 없습니다.</p> : (
            <Table headers={["정산 기간", "창고(스튜디오)", "셀러", "주문", "매출", "창고 몫", "상태"]}
              rows={settlements.map((s) => [
                `${formatDate(s.periodStart)} ~ ${formatDate(s.periodEnd)}`,
                `${s.facility?.name ?? "셀러 공간"}${s.facility ? ` (${FACILITY_OPERATION_LABEL[s.facility.operationType]})` : ""}`,
                s.seller.profile?.name ?? s.seller.email, `${s.orderCount}건`, formatKRW(s.grossAmount), <b key="p">{formatKRW(s.facilityAmount)}</b>,
                <Badge key="s" tone={SETTLEMENT_STATUS[s.status]?.tone}>{SETTLEMENT_STATUS[s.status]?.label}</Badge>,
              ])} />
          )}
        </CardContent>
      </Card>

      <RevenueTable rows={revenue} perspective="FACILITY" />
    </div>
  );
}
