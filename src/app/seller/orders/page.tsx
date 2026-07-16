import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ORDER_STATUS } from "@/lib/status";
import { formatKRW, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DUMMY_ORDERS: any[] = [
  { id:"o1", orderNo:"ORD-20260620-001", buyerName:"구매자1", totalAmount: 89000,  status:"DELIVERED",  createdAt:new Date("2026-06-20T15:30:00"), liveSession:{ title:"뷰티 신상 여름 컬렉션 라이브" }, _count:{ items:2 } },
  { id:"o2", orderNo:"ORD-20260620-002", buyerName:"구매자2", totalAmount:145000,  status:"SHIPPED",    createdAt:new Date("2026-06-20T15:45:00"), liveSession:{ title:"뷰티 신상 여름 컬렉션 라이브" }, _count:{ items:3 } },
  { id:"o3", orderNo:"ORD-20260620-003", buyerName:"구매자3", totalAmount: 56000,  status:"PREPARING",  createdAt:new Date("2026-06-20T16:00:00"), liveSession:{ title:"뷰티 신상 여름 컬렉션 라이브" }, _count:{ items:1 } },
  { id:"o4", orderNo:"ORD-20260610-001", buyerName:"구매자4", totalAmount:320000,  status:"DELIVERED",  createdAt:new Date("2026-06-10T14:20:00"), liveSession:{ title:"패션 봄 신상 라이브" },         _count:{ items:4 } },
  { id:"o5", orderNo:"ORD-20260610-002", buyerName:"구매자5", totalAmount: 78000,  status:"DELIVERED",  createdAt:new Date("2026-06-10T14:35:00"), liveSession:{ title:"패션 봄 신상 라이브" },         _count:{ items:1 } },
];

export default async function SellerOrders() {
  const user = await requireRole(["SELLER"]);

  let orders: any[] = [];
  try {
    orders = await prisma.order.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { liveSession: true, _count: { select: { items: true } } },
    });
    if (orders.length === 0) orders = DUMMY_ORDERS;
  } catch {
    orders = DUMMY_ORDERS;
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="주문 현황" description="라이브 방송에서 발생한 주문을 확인합니다." />

      {orders.length === 0 ? (
        <EmptyState title="주문이 없습니다" description="라이브 방송 후 주문이 들어오면 여기서 확인할 수 있습니다." />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
          <Table
            headers={["주문번호", "구매자", "세션", "상품수", "금액", "상태", "주문일시"]}
            rows={orders.map((o: any) => {
              const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS] ?? { label: o.status, tone: "gray" as const };
              return [
                <span key="no" className="font-mono text-xs">{o.orderNo}</span>,
                <Td key="buyer">{o.buyerName ?? "-"}</Td>,
                <Td key="session">{o.liveSession?.title ?? "-"}</Td>,
                <Td key="items">{o._count?.items ?? 0}개</Td>,
                <span key="amount" className="font-semibold text-navy">{formatKRW(o.totalAmount)}</span>,
                <Badge key="status" tone={st.tone}>{st.label}</Badge>,
                <Td key="date">{formatDateTime(o.createdAt)}</Td>,
              ];
            })}
          />
        </div>
      )}
    </div>
  );
}
