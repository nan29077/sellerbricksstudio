import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/utils";
import { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } from "@/lib/status";
import { CheckCircle2, Blocks } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrderComplete({ params }: { params: { orderId: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { items: true, payment: true, liveSession: true },
  });
  if (!order) notFound();
  const os = ORDER_STATUS[order.status];
  const ps = order.payment ? PAYMENT_STATUS[order.payment.status] : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-white"><div className="container max-w-2xl flex h-14 items-center gap-2"><Blocks className="h-6 w-6 text-brand-500" /><span className="font-bold text-navy">주문 완료</span></div></header>
      <div className="container max-w-2xl py-8">
        <div className="text-center mb-6">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
          <h1 className="mt-3 text-2xl font-bold text-navy">주문이 완료되었습니다</h1>
          <p className="mt-1 text-muted-foreground">주문번호 <span className="font-semibold text-navy">{order.orderNo}</span></p>
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
          <div className="flex justify-between border-t pt-3"><span className="font-semibold">총 결제금액</span><span className="text-lg font-bold text-brand-600">{formatKRW(order.totalAmount)}</span></div>
        </CardContent></Card>
        <div className="mt-5 flex gap-2">
          <Link href={`/live/${order.liveSession.slug}`} className="flex-1"><Button variant="outline" className="w-full">방송으로 돌아가기</Button></Link>
          <Link href="/" className="flex-1"><Button className="w-full">홈으로</Button></Link>
        </div>
      </div>
    </div>
  );
}
