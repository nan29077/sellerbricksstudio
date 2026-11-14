import Link from "next/link";
import { ClipboardList, Package, ShoppingBag, Store, Truck, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brandSalesSummary } from "@/lib/purchase-orders";
import { getPolicy } from "@/lib/policy";
import { formatKRW } from "@/lib/utils";
import { KpiTile } from "@/components/dashboard/kit";

// 브랜드 대시보드: 발주 · 판매 전환 · 판매처 현황
export async function BrandInsights({ shopId }: { shopId: string }) {
  const policy = await getPolicy();
  const lateBefore = new Date(Date.now() - policy.poConfirmHours * 3600000);
  const [summary, newPos, latePos, pendingSamples, sellerListings, facilityListings, topItems, lowStock] = await Promise.all([
    brandSalesSummary(shopId),
    prisma.purchaseOrder.count({ where: { brandShopId: shopId, status: "NEW" } }),
    prisma.purchaseOrder.count({ where: { brandShopId: shopId, status: "NEW", createdAt: { lt: lateBefore } } }),
    prisma.brandRequest.count({ where: { product: { shopId }, status: { in: ["PENDING", "AWAITING_PAYMENT"] } } }),
    prisma.sellerBrandProduct.findMany({ where: { brandProduct: { shopId }, isActive: true }, select: { seller: { select: { id: true, email: true, profile: { select: { name: true } } } }, brandProduct: { select: { name: true } }, salePrice: true }, take: 50 }),
    prisma.facilityProduct.findMany({ where: { brandProduct: { shopId } }, select: { fulfillment: true, stock: true, salePrice: true, facility: { select: { id: true, name: true } }, brandProduct: { select: { name: true } } }, take: 50 }),
    prisma.purchaseOrderItem.groupBy({ by: ["brandProductId", "productName"], where: { purchaseOrder: { brandShopId: shopId, status: { notIn: ["CANCELLED", "RETURNED"] } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    prisma.brandProduct.findMany({ where: { shopId, isActive: true, stock: { lte: 10 } }, select: { id: true, name: true, stock: true }, take: 5 }),
  ]);
  const channels = new Set([...sellerListings.map((l) => `s:${l.seller.id}`), ...facilityListings.map((l) => `f:${l.facility.id}`)]).size;
  return (
    <section id="insights" className="scroll-mt-24 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="신규 발주" value={newPos.toLocaleString()} unit="건" sub={latePos ? `확인 지연 ${latePos}건` : "확인 대기"} icon={ClipboardList} tone={latePos ? "red" : "brand"} href="/brand/orders?status=NEW" emphasis={newPos > 0} />
        <KpiTile label="진행 중 발주 금액" value={formatKRW(summary.openAmount)} sub={`${summary.openCount}건`} icon={Truck} tone="blue" href="/brand/orders" />
        <KpiTile label="정산 예정 (배송 완료)" value={formatKRW(summary.unsettledAmount)} sub={`누적 지급 ${formatKRW(summary.paidOut)}`} icon={ShoppingBag} tone="green" href="/brand/settlements" />
        <KpiTile label="판매처" value={channels.toLocaleString()} unit="곳" sub={`샘플 대기 ${pendingSamples}건`} icon={Users} tone="navy" href="/brand/requests?status=PENDING" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <p className="mb-2 flex items-center gap-1.5 font-extrabold text-navy"><Store className="h-4 w-4 text-brand-600" />내 상품을 판매하는 곳</p>
          {channels === 0 ? <p className="text-sm text-slate-500">아직 없습니다. 샘플을 보내 셀러·공간에 상품을 알려 보세요.</p> : (
            <ul className="max-h-56 space-y-1 overflow-auto text-sm">
              {facilityListings.map((l, i) => <li key={`f${i}`} className="flex justify-between gap-2"><span className="truncate">🏬 {l.facility.name} · {l.brandProduct?.name}</span><span className="shrink-0 text-xs text-slate-500">{l.fulfillment === "WAREHOUSE" ? `위탁재고 ${l.stock}` : "직배송"}</span></li>)}
              {sellerListings.map((l, i) => <li key={`s${i}`} className="flex justify-between gap-2"><span className="truncate">🎥 {l.seller.profile?.name ?? l.seller.email} · {l.brandProduct.name}</span><span className="shrink-0 text-xs text-slate-500">{formatKRW(l.salePrice)}</span></li>)}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="mb-2 flex items-center gap-1.5 font-extrabold text-navy"><ShoppingBag className="h-4 w-4 text-brand-600" />많이 팔린 상품</p>
          {topItems.length === 0 ? <p className="text-sm text-slate-500">판매된 상품이 없습니다.</p> :
            <ol className="space-y-1 text-sm">{topItems.map((t, i) => <li key={t.brandProductId} className="flex justify-between"><span className="truncate">{i + 1}. {t.productName}</span><b>{(t._sum.quantity ?? 0).toLocaleString()}개</b></li>)}</ol>}
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="mb-2 flex items-center gap-1.5 font-extrabold text-navy"><Package className="h-4 w-4 text-brand-600" />재고 부족 (10개 이하)</p>
          {lowStock.length === 0 ? <p className="text-sm text-slate-500">재고가 충분합니다.</p> :
            <ul className="space-y-1 text-sm">{lowStock.map((p) => <li key={p.id} className="flex justify-between"><span className="truncate">{p.name}</span><b className={p.stock === 0 ? "text-red-600" : ""}>{p.stock}개</b></li>)}</ul>}
          <Link href="/brand/products?filter=low" className="mt-2 inline-block text-xs font-semibold text-brand-800 underline">재고 수정</Link>
        </div>
      </div>
    </section>
  );
}
