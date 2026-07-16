import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ORDER_STATUS } from "@/lib/status";
import { formatKRW, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DUMMY_ORDERS: any[] = [
  { id:"o1", orderNo:"ORD-20260620-001", buyerName:"구매자1", totalAmount: 89000, status:"DELIVERED", createdAt:new Date("2026-06-20T15:30:00"), liveSession:{ title:"뷰티 신상 여름 컬렉션 라이브" }, seller:{ profile:{ name:"박지현" } } },
  { id:"o2", orderNo:"ORD-20260620-002", buyerName:"구매자2", totalAmount:145000, status:"SHIPPED",   createdAt:new Date("2026-06-20T15:45:00"), liveSession:{ title:"뷰티 신상 여름 컬렉션 라이브" }, seller:{ profile:{ name:"박지현" } } },
  { id:"o3", orderNo:"ORD-20260610-001", buyerName:"구매자3", totalAmount:320000, status:"DELIVERED", createdAt:new Date("2026-06-10T14:20:00"), liveSession:{ title:"패션 봄 신상 라이브" },         seller:{ profile:{ name:"홍길동" } } },
  { id:"o4", orderNo:"ORD-20260610-002", buyerName:"구매자4", totalAmount: 56000, status:"CANCELLED", createdAt:new Date("2026-06-10T15:00:00"), liveSession:{ title:"패션 봄 신상 라이브" },         seller:{ profile:{ name:"홍길동" } } },
];

export default async function FacilityOrders() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let orders: any[] = [];
  try {
    const facIds = await ownedFacilityIds(user.id);
    orders = await prisma.order.findMany({
      where: { facilityId: { in: facIds } },
      orderBy: { createdAt: "desc" },
      include: {
        liveSession: { select: { title: true } },
        seller: { select: { profile: { select: { name: true } } } },
      },
    });
    if (orders.length === 0) orders = DUMMY_ORDERS;
  } catch {
    orders = DUMMY_ORDERS;
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="주문 현황" description="시설에서 진행된 라이브 방송의 주문 현황입니다." />

      {orders.length === 0 ? (
        <EmptyState title="주문이 없습니다" description="라이브 방송 후 주문 내역이 여기에 표시됩니다." />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
          <Table
            headers={["주문번호", "구매자", "셀러", "세션", "금액", "상태", "주문일시"]}
            rows={orders.map((o: any) => {
              const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS] ?? { label: o.status, tone: "gray" as const };
              return [
                <span key="no" className="font-mono text-xs">{o.orderNo}</span>,
                <Td key="buyer">{o.buyerName ?? "-"}</Td>,
                <Td key="seller">{o.seller?.profile?.name ?? "-"}</Td>,
                <Td key="session">{o.liveSession?.title ?? "-"}</Td>,
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
