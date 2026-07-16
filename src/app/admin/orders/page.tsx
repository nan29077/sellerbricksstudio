import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ORDER_STATUS } from "@/lib/status";
import { formatKRW, formatDateTime } from "@/lib/utils";
import { Package, ShoppingCart, TrendingUp, Truck, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  await requireRole(["SUPER_ADMIN"]);

  let orders: any[] = [];
  let totalAmount = 0;
  let counts = { total: 0, paid: 0, preparing: 0, shipped: 0, delivered: 0 };

  try {
    orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        facility: { select: { name: true } },
        seller: { include: { profile: { select: { name: true } } } },
      },
      take: 200,
    });
    totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    counts = {
      total: orders.length,
      paid: orders.filter((o) => o.status === "PAID").length,
      preparing: orders.filter((o) => o.status === "PREPARING").length,
      shipped: orders.filter((o) => o.status === "SHIPPED").length,
      delivered: orders.filter((o) => o.status === "DELIVERED").length,
    };
  } catch { /* DB not available */ }

  return (
    <div className="space-y-5">
      <PageHeader title="주문 관리" description="전체 주문 현황 및 처리 상태" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "전체 주문", value: `${counts.total}건`, icon: ShoppingCart, color: "text-blue-600 bg-blue-50" },
          { label: "총 거래액", value: formatKRW(totalAmount), icon: TrendingUp, color: "text-brand-600 bg-brand-50" },
          { label: "배송 중", value: `${counts.shipped}건`, icon: Truck, color: "text-purple-600 bg-purple-50" },
          { label: "배송 완료", value: `${counts.delivered}건`, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold text-navy">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Table headers={["주문번호", "시설", "셀러", "구매자", "금액", "상태", "일시"]}>
        {orders.map((o) => {
          const s = ORDER_STATUS[o.status] ?? { label: o.status, tone: "gray" };
          return (
            <tr key={o.id} className="hover:bg-muted/30 transition">
              <Td className="font-mono text-xs text-muted-foreground">{o.orderNo}</Td>
              <Td className="font-medium text-navy">{o.facility?.name ?? "-"}</Td>
              <Td>{o.seller?.profile?.name ?? "-"}</Td>
              <Td>{o.buyerName}</Td>
              <Td className="font-semibold text-navy">{formatKRW(o.totalAmount)}</Td>
              <Td><Badge tone={s.tone}>{s.label}</Badge></Td>
              <Td className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
