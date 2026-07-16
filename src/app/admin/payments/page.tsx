import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKRW, formatDateTime } from "@/lib/utils";
import { CreditCard, CheckCircle2, XCircle, RefreshCw, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_PAYMENTS = [
  { id:"p1", orderNo:"ORD-20260620-001", provider:"토스페이먼츠", method:"CARD",     amount:  89_000, status:"PAID",     pgTxId:"toss_001", createdAt: new Date("2026-06-20T15:32:00") },
  { id:"p2", orderNo:"ORD-20260620-002", provider:"토스페이먼츠", method:"CARD",     amount: 145_000, status:"PAID",     pgTxId:"toss_002", createdAt: new Date("2026-06-20T15:47:00") },
  { id:"p3", orderNo:"ORD-20260619-001", provider:"카카오페이",   method:"KAKAOPAY", amount:  56_000, status:"PAID",     pgTxId:"kakao_01", createdAt: new Date("2026-06-19T11:20:00") },
  { id:"p4", orderNo:"ORD-20260619-002", provider:"토스페이먼츠", method:"BANK",     amount: 320_000, status:"PAID",     pgTxId:"toss_003", createdAt: new Date("2026-06-19T14:55:00") },
  { id:"p5", orderNo:"ORD-20260618-001", provider:"카카오페이",   method:"KAKAOPAY", amount:  78_000, status:"REFUNDED", pgTxId:"kakao_02", createdAt: new Date("2026-06-18T09:10:00") },
  { id:"p6", orderNo:"ORD-20260617-001", provider:"토스페이먼츠", method:"CARD",     amount: 210_000, status:"PAID",     pgTxId:"toss_004", createdAt: new Date("2026-06-17T16:22:00") },
  { id:"p7", orderNo:"ORD-20260616-001", provider:"토스페이먼츠", method:"CARD",     amount:  45_000, status:"FAILED",   pgTxId:"toss_005", createdAt: new Date("2026-06-16T13:05:00") },
];

const STATUS_MAP: Record<string, { label: string; tone: "green" | "red" | "yellow" | "gray" }> = {
  PAID:     { label: "결제완료", tone: "green" },
  REFUNDED: { label: "환불",    tone: "yellow" },
  FAILED:   { label: "실패",    tone: "red" },
  PENDING:  { label: "대기",    tone: "gray" },
};

export default async function AdminPayments() {
  await requireRole(["SUPER_ADMIN"]);

  let payments: any[] = [];
  try {
    payments = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    if (payments.length === 0) payments = DUMMY_PAYMENTS;
  } catch {
    payments = DUMMY_PAYMENTS;
  }

  const paid     = payments.filter((p) => p.status === "PAID").length;
  const refunded = payments.filter((p) => p.status === "REFUNDED").length;
  const failed   = payments.filter((p) => p.status === "FAILED").length;
  const total    = payments.filter((p) => p.status === "PAID").reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="결제 내역" description="전체 결제 트랜잭션 현황을 확인합니다." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="결제 완료"  value={`${paid}건`}       sub="이번 달"    icon={CheckCircle2} />
        <StatCard label="환불"       value={`${refunded}건`}   sub="처리됨"     icon={RefreshCw}    />
        <StatCard label="실패"       value={`${failed}건`}     sub="재시도 필요" icon={XCircle}     />
        <StatCard label="총 결제액"  value={formatKRW(total)}  sub="합산"       icon={TrendingUp}   />
      </div>

      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <table className="w-full text-sm">
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
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs">{p.orderNo}</span>
                      </div>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">{p.provider}</td>
                    <td className="py-3 text-center text-xs">{p.method}</td>
                    <td className="py-3 text-right font-semibold">{formatKRW(p.amount)}</td>
                    <td className="py-3 text-center">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="py-3 text-right text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
