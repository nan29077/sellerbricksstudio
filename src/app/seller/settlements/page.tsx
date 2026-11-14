import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { computeSettlement, revenueLines } from "@/lib/settlement";
import { RevenueTable } from "@/components/settlement/revenue-table";
import { formatDate, formatKRW } from "@/lib/utils";
import type { SP } from "@/lib/list";
import { Wallet, CalendarCheck, TrendingUp, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";
const SETTLE_STATUS: Record<string, { label: string; tone: "yellow" | "blue" | "green" }> = {
  PENDING: { label: "정산 대기", tone: "yellow" }, CONFIRMED: { label: "정산 확정", tone: "blue" }, PAID: { label: "지급 완료", tone: "green" },
};

export default async function SellerSettlements({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  // 창고(스튜디오) 이용료는 없다(무료) — 판매 정산만 보여 준다. (예전 '이용 내역' 탭은 없앴다)
  const [settlements, sales, revenue, account] = await Promise.all([
    prisma.settlement.findMany({ where: { sellerId: user.id }, orderBy: { periodEnd: "desc" }, include: { facility: { select: { name: true } } } }),
    computeSettlement({ sellerId: user.id }).catch(() => ({ orderCount: 0, gross: 0, sellerProfit: 0, facilityAmount: 0 })),
    revenueLines({ sellerId: user.id }).catch(() => []),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { bankAccount: true } }).catch(() => null),
  ]);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="정산 내역" description="판매 정산 현황을 확인합니다. 창고(스튜디오) 이용료는 없습니다." />

        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="판매 매출" value={formatKRW(sales?.gross ?? 0)} sub={`주문 ${sales?.orderCount ?? 0}건`} icon={TrendingUp} tone="navy" />
            <Kpi label="셀러 수익(예상)" value={formatKRW(sales?.sellerProfit ?? 0)} sub={sales && "platformFee" in sales ? `플랫폼 수수료 ${formatKRW(sales.platformFee)} · 브랜드 대금 ${formatKRW(sales.brandAmount)} 제외` : undefined} icon={Wallet} tone="brand" />
            <Kpi label="정산 대기" value={formatKRW(settlements.filter((s) => s.status !== "PAID").reduce((a, s) => a + s.commissionAmount, 0))} icon={CalendarCheck} tone="blue" />
            <Kpi label="지급 완료" value={formatKRW(settlements.filter((s) => s.status === "PAID").reduce((a, s) => a + s.commissionAmount, 0))} icon={Banknote} tone="green" />
          </div>
          {!account?.bankAccount && !user.id.startsWith("demo-") && (
            <Link href="/seller/settings" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <Banknote className="h-5 w-5" />정산 계좌가 등록되지 않았습니다. 설정에서 정산 계좌를 등록해야 판매 정산금을 받을 수 있습니다.
            </Link>
          )}
          <RevenueTable rows={revenue} perspective="SELLER" />
          {settlements.length === 0 ? <EmptyState title="판매 정산 내역이 없습니다" description="라이브 판매 정산이 생성되면 여기에 표시됩니다." /> : (
            <Table headers={["정산 기간", "창고(스튜디오)", "총 매출", "셀러 수익", "창고 정산금", "상태"]}
              rows={settlements.map((s) => [`${formatDate(s.periodStart)} ~ ${formatDate(s.periodEnd)}`, (s.facility?.name ?? "셀러 공간"), formatKRW(s.grossAmount), <b key="c">{formatKRW(s.commissionAmount)}</b>, formatKRW(s.facilityAmount), <Badge key="s" tone={SETTLE_STATUS[s.status]?.tone}>{SETTLE_STATUS[s.status]?.label}</Badge>])} />
          )}
        </>
    </div>
  );
}
