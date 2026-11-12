import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/utils";
import { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } from "@/lib/status";
import { CheckCircle2, Blocks } from "lucide-react";
import { OrderClaimBox } from "@/components/order-claim-box";
import { claimOptions } from "@/lib/order-claims";
import { BUSINESS_INFO } from "@/lib/business-info";

export const dynamic = "force-dynamic";

export default async function OrderComplete({ params }: { params: { orderId: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      items: { include: { liveSessionProduct: { select: { brandProductId: true, fulfillment: true, source: true, facilityProduct: { select: { brandProductId: true, fulfillment: true } } } } } },
      payment: true, liveSession: true,
      facility: { select: { name: true, address: true, contactPhone: true } },
      seller: { select: { profile: { select: { name: true, companyName: true, businessNumber: true } } } },
      claims: { orderBy: { createdAt: "desc" }, take: 5 },
      purchaseOrders: { select: { id: true, status: true, fulfillment: true, carrier: true, trackingNumber: true, brandShop: { select: { name: true } } } },
    },
  });
  if (!order) notFound();
  const os = ORDER_STATUS[order.status];
  const heading =
    order.status === "CANCELLED" ? "취소된 주문입니다" :
    order.status === "REFUNDED" ? "환불된 주문입니다" :
    order.status === "SHIPPED" ? "상품이 배송 중입니다" :
    order.status === "DELIVERED" ? "배송이 완료되었습니다" :
    order.status === "PREPARING" ? "상품을 준비하고 있습니다" : "주문이 완료되었습니다";
  const finished = order.status === "CANCELLED" || order.status === "REFUNDED";
  const ps = order.payment ? PAYMENT_STATUS[order.payment.status] : null;
  const dropships = order.purchaseOrders.filter((po) => po.fulfillment === "DROPSHIP");
  const claimOpt = claimOptions(order);
  const sellerProfile = order.seller.profile;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-white"><div className="container max-w-2xl flex h-14 items-center gap-2"><Blocks className="h-6 w-6 text-brand-500" /><span className="font-bold text-navy">주문 내역</span></div></header>
      <div className="container max-w-2xl py-8">
        <div className="text-center mb-6">
          <CheckCircle2 className={`mx-auto h-16 w-16 ${finished ? "text-slate-300" : "text-emerald-500"}`} />
          <h1 className="mt-3 text-2xl font-bold text-navy">{heading}</h1>
          <p className="mt-1 text-muted-foreground">주문번호 <span className="font-semibold text-navy">{order.orderNo}</span></p>
          <p className="mt-2 text-xs text-muted-foreground">주문번호와 연락처로 <Link href="/order-lookup" className="font-semibold text-brand-700 underline underline-offset-2">주문 조회</Link>에서 언제든 다시 확인할 수 있어요.</p>
        </div>
        <Card><CardContent className="pt-5 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">주문상태</span><Badge tone={os.tone}>{os.label}</Badge></div>
          {ps && <div className="flex justify-between text-sm"><span className="text-muted-foreground">결제상태</span><Badge tone={ps.tone}>{ps.label}</Badge></div>}
          {order.payment && <div className="flex justify-between text-sm"><span className="text-muted-foreground">결제수단</span><span>{PAYMENT_METHOD[order.payment.method]}</span></div>}
          <div className="border-t pt-3 space-y-2">
            {order.items.map((i) => (
              <div key={i.id} className="flex items-center gap-2 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-500 text-xs font-bold text-white">{i.displayNumber}</span>
                <span className="flex-1 truncate">{i.productName}</span><span>{i.quantity}개</span>
                <span className="w-20 text-right font-semibold">{formatKRW(i.lineTotal)}</span>
              </div>
            ))}
          </div>
          {order.discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>쿠폰 할인{order.couponCode ? ` (${order.couponCode})` : ""}</span><span>-{formatKRW(order.discountAmount)}</span></div>}
          {order.shippingFee > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">배송비</span><span>{formatKRW(order.shippingFee)}</span></div>}
          {(order.localShippedAt || dropships.length > 0) && (
            <div className="space-y-1 border-t pt-3 text-sm">
              <p className="font-semibold text-navy">배송 조회</p>
              {order.localShippedAt && (
                <p className="text-slate-600">{order.facilityId ? "판매처 출고" : "셀러 출고"} · <b>{order.localDeliveredAt ? "배송 완료" : "배송 중"}</b>{order.shipTrackingNumber && ` · ${order.shipCarrier ?? ""} ${order.shipTrackingNumber}`}</p>
              )}
              {dropships.map((po) => (
                <p key={po.id} className="text-slate-600">{po.brandShop.name} 직배송 · <b>{po.status === "DELIVERED" ? "배송 완료" : po.status === "SHIPPED" ? "배송 중" : po.status === "CANCELLED" || po.status === "RETURNED" ? "취소 · 반품" : "출고 준비 중"}</b>{po.trackingNumber && ` · ${po.carrier} ${po.trackingNumber}`}</p>
              ))}
            </div>
          )}
          <div className="flex justify-between border-t pt-3"><span className="font-semibold">총 결제금액</span><span className="text-lg font-bold text-brand-600">{formatKRW(order.totalAmount)}</span></div>
        </CardContent></Card>
        <Card className="mt-4"><CardContent className="pt-5">
          <h2 className="mb-3 font-bold text-navy">취소 · 반품 · 교환</h2>
          <OrderClaimBox orderId={order.id} types={claimOpt.types} blockedReason={claimOpt.reason}
            claims={order.claims.map((c) => ({ id: c.id, type: c.type, status: c.status, reason: c.reason, detail: c.detail, answer: c.answer, createdAt: c.createdAt.toISOString() }))} />
        </CardContent></Card>
        <Card className="mt-4"><CardContent className="pt-5 text-xs text-slate-600 space-y-1.5">
          <h2 className="mb-2 text-sm font-bold text-navy">판매자 정보</h2>
          <p><span className="text-slate-500">판매자</span> {sellerProfile?.companyName || sellerProfile?.name || "셀러"}{sellerProfile?.businessNumber ? ` · 사업자등록번호 ${sellerProfile.businessNumber}` : ""}</p>
          {order.facility && <p><span className="text-slate-500">출고지</span> {order.facility.name}{order.facility.contactPhone ? ` · ${order.facility.contactPhone}` : ""}</p>}
          {dropships.length > 0 && <p><span className="text-slate-500">직배송</span> {Array.from(new Set(dropships.map((p) => p.brandShop.name))).join(", ")}</p>}
          <p className="pt-2 text-[11px] leading-relaxed text-slate-500">{BUSINESS_INFO.companyName}는 통신판매중개자로서 거래 당사자가 아니며, 상품 · 거래 정보와 거래에 대한 책임은 판매자에게 있습니다. 상품을 받은 날부터 7일 이내에 청약철회(반품)를 요청할 수 있으며, 단순 변심인 경우 반품 배송비는 구매자가 부담합니다. 문의: 고객센터 {BUSINESS_INFO.phone}</p>
        </CardContent></Card>
        <div className="mt-5 flex gap-2">
          <Link href={`/live/${order.liveSession.slug}`} className="flex-1"><Button variant="outline" className="w-full">방송으로 돌아가기</Button></Link>
          <Link href="/" className="flex-1"><Button className="w-full">홈으로</Button></Link>
        </div>
      </div>
    </div>
  );
}
