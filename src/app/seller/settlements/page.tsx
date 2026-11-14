import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi, BarChart } from "@/components/list/charts";
import { CsvButton } from "@/components/list/csv-button";
import { Pagination } from "@/components/list/pagination";
import { ORDER_STATUS } from "@/lib/status";
import { livePlatformLabel } from "@/lib/live-platforms";
import { formatDateTime, formatKRW } from "@/lib/utils";
import { addMonths, kstParts, kstStartOfMonth } from "@/lib/kst";
import { growth, pageOf, type SP } from "@/lib/list";
import { Banknote, CalendarCheck, TrendingUp, Undo2 } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/seller/settlements";
const PAID_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

// 셀러 결제 · 정산 내역 — 구매자 결제는 없다. 셀러는 주문서를 낼 때 공급가(+ 스토리지마켓 출고 배송비)를 결제하고,
// 판매 대금은 판매한 라이브 플랫폼에서 받는다. 여기서는 주문서 결제 · 환불 내역을 보여 준다.
export default async function SellerPayments({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const monthStart = kstStartOfMonth(new Date());
  const yearStart = addMonths(monthStart, -11);
  // 결제가 실패해 닫힌 주문서는 빼고, 실제로 결제된(이후 취소 · 환불 포함) 주문서만
  const where = { sellerId: user.id, source: "SHEET", status: { in: [...PAID_STATUSES] }, payment: { status: { in: ["PAID", "CANCELLED", "REFUNDED"] as ("PAID" | "CANCELLED" | "REFUNDED")[] } } };
  const [rows, total, yearRows, sums] = await Promise.all([
    prisma.order.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take,
      select: { id: true, orderNo: true, createdAt: true, status: true, totalAmount: true, refundedAmount: true, shippingFee: true, platform: true, externalOrderNo: true, buyerName: true, facility: { select: { name: true } }, items: { select: { productName: true, quantity: true } } },
    }),
    prisma.order.count({ where }),
    prisma.order.findMany({ where: { ...where, createdAt: { gte: yearStart } }, select: { createdAt: true, totalAmount: true, refundedAmount: true } }),
    prisma.order.aggregate({ where, _sum: { totalAmount: true, refundedAmount: true }, _count: true }),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  const monthly = months.map((m) => ({ label: `${kstParts(m).month}월`, value: yearRows.filter((o) => o.createdAt >= m && o.createdAt < addMonths(m, 1)).reduce((s, o) => s + o.totalAmount - o.refundedAmount, 0) }));
  const paid = sums._sum.totalAmount ?? 0, refunded = sums._sum.refundedAmount ?? 0;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="결제 · 정산 내역" description="주문서를 낼 때 결제한 공급가와 환불 내역입니다. 판매 대금은 판매한 라이브 플랫폼에서 정산받습니다."
        action={<Link href="/seller/orders/new" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-white">주문서 작성</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="이번 달 결제 (환불 제외)" value={formatKRW(monthly[11].value)} delta={growth(monthly[11].value, monthly[10].value)} sub="지난달 대비" icon={TrendingUp} tone="navy" />
        <Kpi label="누적 결제" value={formatKRW(paid)} sub={`주문 ${sums._count}건`} icon={Banknote} tone="brand" />
        <Kpi label="누적 환불" value={formatKRW(refunded)} icon={Undo2} tone="blue" />
        <Kpi label="실제 결제 합계" value={formatKRW(paid - refunded)} icon={CalendarCheck} tone="green" />
      </div>
      <div className="rounded-2xl border border-[#E9E5DC] bg-white p-4"><p className="mb-2 text-sm font-bold text-navy">월별 결제 (12개월 · 환불 제외)</p><BarChart data={monthly} format={(n) => formatKRW(n)} /></div>
      {rows.length === 0 ? <EmptyState title="결제 내역이 없습니다" description="주문서를 작성해 결제하면 여기에 표시됩니다." /> : (
        <>
          <div className="flex justify-end">
            <CsvButton label="CSV" filename="주문서결제내역" headers={["결제일", "주문번호", "플랫폼", "외부 주문번호", "받는 분", "상품", "보내는 곳", "배송비", "결제액", "환불액", "상태"]}
              rows={rows.map((o) => [formatDateTime(o.createdAt), o.orderNo, livePlatformLabel(o.platform), o.externalOrderNo ?? "", o.buyerName, o.items.map((i) => `${i.productName}×${i.quantity}`).join(", "), o.facility?.name ?? "브랜드 직배송", o.shippingFee, o.totalAmount, o.refundedAmount, ORDER_STATUS[o.status]?.label ?? o.status])} />
          </div>
          <ul className="space-y-2">
            {rows.map((o) => {
              const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: "gray" as const };
              return (
                <li key={o.id} className="rounded-2xl border border-border bg-white p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-navy">{o.orderNo}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="ml-auto font-extrabold text-navy">{formatKRW(o.totalAmount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(o.createdAt)} · {livePlatformLabel(o.platform)}{o.externalOrderNo ? ` · ${o.externalOrderNo}` : ""} · {o.facility?.name ? `스토리지마켓 (${o.facility.name})` : "브랜드 직배송"}</p>
                  <p className="mt-1 text-xs text-slate-600">{o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}{o.shippingFee ? ` · 배송비 ${formatKRW(o.shippingFee)}` : ""}</p>
                  {o.refundedAmount > 0 && <p className="mt-1 text-xs font-semibold text-blue-700">환불 {formatKRW(o.refundedAmount)}</p>}
                </li>
              );
            })}
          </ul>
          <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
        </>
      )}
    </div>
  );
}
