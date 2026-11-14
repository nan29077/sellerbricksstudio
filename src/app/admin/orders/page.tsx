import { prisma } from "@/lib/prisma";
import { PO_CHIP_INCLUDE } from "@/components/brand/po-chips";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { formatKRW } from "@/lib/utils";
import { OrderCardList } from "@/components/order-card-list";
import { ORDER_ACTION_INCLUDE } from "@/lib/order-action-props";
import { Pagination } from "@/components/list/pagination";
import { pageOf, sp, type SP } from "@/lib/list";
import { getPolicy } from "@/lib/policy";
import { OrderFilterTabs } from "@/components/order-filter-tabs";
import { orderFilterWhere } from "@/lib/order-view";
import { Package, ShoppingCart, TrendingUp, Truck, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const BASE = "/admin/orders";

export default async function AdminOrders({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const status = sp(searchParams, "status") ?? "";
  const q = sp(searchParams, "q") ?? "";
  const { page, size, skip, take } = pageOf(searchParams, 30);
  const policy = await getPolicy();
  let total = 0;

  let orders: any[] = [];
  let totalAmount = 0;
  let counts = { total: 0, paid: 0, preparing: 0, shipped: 0, delivered: 0 };

  try {
    const where = {
      ...orderFilterWhere(status),
      ...(q && { AND: [{ OR: [{ orderNo: { contains: q, mode: "insensitive" as const } }, { buyerName: { contains: q } }] }] }),
    };
    const [rows, count, byStatus, sum] = await Promise.all([
      prisma.order.findMany({
        where, orderBy: { createdAt: "desc" }, skip, take,
        include: {
          facility: { select: { name: true } },
          seller: { select: { profile: { select: { name: true } } } },
          liveSession: { select: { title: true } },
          purchaseOrders: PO_CHIP_INCLUDE,
          ...ORDER_ACTION_INCLUDE,
        },
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({ by: ["status"], _count: true }),
      prisma.order.aggregate({ where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } }, _sum: { totalAmount: true, refundedAmount: true } }),
    ]);
    orders = rows; total = count;
    const n = (k: string) => byStatus.find((b) => b.status === k)?._count ?? 0;
    totalAmount = (sum._sum.totalAmount ?? 0) - (sum._sum.refundedAmount ?? 0);
    counts = { total: byStatus.reduce((a, b) => a + b._count, 0), paid: n("PAID"), preparing: n("PREPARING"), shipped: n("SHIPPED"), delivered: n("DELIVERED") };
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

      <OrderFilterTabs base={BASE} params={searchParams} current={status} q={q} exportHref="/api/orders/export?scope=all" />

      {orders.length === 0
        ? <EmptyState title="주문이 없습니다" description={status || q ? "조건에 맞는 주문이 없습니다." : "라이브 방송 후 주문이 들어오면 여기에 표시됩니다."} className="mt-4" />
        : <OrderCardList orders={orders} actor={{ isAdmin: true, isSeller: false, isFacilityOwner: false }} piiRetentionDays={policy.piiRetentionDays} show={{ seller: true, place: true }} />}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
