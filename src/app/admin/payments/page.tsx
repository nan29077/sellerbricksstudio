import { requireRole } from "@/lib/auth";
import { PAYMENT_METHOD } from "@/lib/status";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKRW, formatDateTime } from "@/lib/utils";
import { CreditCard, CheckCircle2, XCircle, RefreshCw, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";


const STATUS_MAP: Record<string, { label: string; tone: "green" | "red" | "yellow" | "gray" }> = {
  PAID:        { label: "결제완료", tone: "green" },
  REFUNDED:    { label: "환불",    tone: "yellow" },
  CANCELLED:   { label: "취소",    tone: "gray" },
  FAILED:      { label: "실패",    tone: "red" },
  IN_PROGRESS: { label: "결제 중", tone: "yellow" },
  READY:       { label: "대기",    tone: "gray" },
  PENDING:     { label: "대기",    tone: "gray" },
};

export default async function AdminPayments() {
  await requireRole(["SUPER_ADMIN"]);

  let payments: any[] = [];
  try {
    // 실제 결제 내역만 보여 준다 (예전에는 결제가 없거나 DB 오류일 때 예시 결제를 보여 줘 실제 매출처럼 보였다)
    const rows = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { order: { select: { orderNo: true } } } });
    payments = rows.map((p) => ({ ...p, orderNo: p.order.orderNo, method: PAYMENT_METHOD[p.method as keyof typeof PAYMENT_METHOD] ?? p.method }));
  } catch {
    payments = [];
  }

  const paid     = payments.filter((p) => p.status === "PAID").length;
  const refunded = payments.filter((p) => p.status === "REFUNDED").length;
  const failed   = payments.filter((p) => p.status === "FAILED").length;
  const total    = payments.filter((p) => p.status === "PAID").reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="결제 내역" description="전체 결제 트랜잭션 현황을 확인합니다." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="결제 완료"  value={`${paid}건`}       sub="최근 50건 중" icon={CheckCircle2} />
        <StatCard label="환불"       value={`${refunded}건`}   sub="처리됨"     icon={RefreshCw}    />
        <StatCard label="실패"       value={`${failed}건`}     sub="재시도 필요" icon={XCircle}     />
        <StatCard label="총 결제액"  value={formatKRW(total)}  sub="합산"       icon={TrendingUp}   />
      </div>

      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <table className="w-full text-sm rtable">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">주문번호</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">PG사</th>
                <th className="text-center py-2 text-xs text-muted-foreground font-medium">수단</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">금액</th>
                <th className="text-center py-2 text-xs text-muted-foreground font-medium">상태</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">결제일시</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => {
                const st = STATUS_MAP[p.status] ?? { label: p.status, tone: "gray" as const };
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                    <td data-label="주문번호" className="py-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs">{p.orderNo}</span>
                      </div>
                    </td>
                    <td data-label="PG사" className="py-3 text-xs text-muted-foreground">{p.provider}</td>
                    <td data-label="수단" className="py-3 text-center text-xs">{p.method}</td>
                    <td data-label="금액" className="py-3 text-right font-semibold">{formatKRW(p.amount)}</td>
                    <td data-label="상태" className="py-3 text-center">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td data-label="결제일시" className="py-3 text-right text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {payments.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">아직 결제 내역이 없습니다.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
