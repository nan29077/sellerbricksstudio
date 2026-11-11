import { prisma } from "@/lib/prisma";
import { LocalShipChip, PoChips, PO_CHIP_INCLUDE } from "@/components/brand/po-chips";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ORDER_STATUS } from "@/lib/status";
import { formatKRW, formatDateTime } from "@/lib/utils";
import { OrderStatusActions } from "@/components/order-status-actions";
import { ORDER_ACTION_INCLUDE, orderActionProps } from "@/lib/order-action-props";

export const dynamic = "force-dynamic";

export default async function SellerOrders() {
  const user = await requireRole(["SELLER"]);

  let orders: any[] = [];
  const isDemo = false;
  try {
    orders = await prisma.order.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { liveSession: true, _count: { select: { items: true } }, purchaseOrders: PO_CHIP_INCLUDE, ...ORDER_ACTION_INCLUDE },
    });
  } catch {
    orders = []; // DB 오류 시 빈 목록 (예시 주문은 보여 주지 않는다)
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="주문 현황" description="라이브 방송에서 발생한 주문을 확인합니다." />

      {orders.length === 0 ? (
        <EmptyState title="주문이 없습니다" description="라이브 방송 후 주문이 들어오면 여기서 확인할 수 있습니다." />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
          <Table
            headers={["주문번호", "구매자", "세션", "상품수", "금액", "상태", "주문일시", "처리"]}
            rows={orders.map((o: any) => {
              const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS] ?? { label: o.status, tone: "gray" as const };
              return [
                <span key="no" className="font-mono text-xs">{o.orderNo}</span>,
                <Td key="buyer">{o.buyerName ?? "-"}</Td>,
                <Td key="session">{o.liveSession?.title ?? "-"}</Td>,
                <Td key="items">{o._count?.items ?? 0}개</Td>,
                <span key="amount" className="font-semibold text-navy">{formatKRW(o.totalAmount)}</span>,
                <div key="status"><Badge tone={st.tone}>{st.label}</Badge><LocalShipChip order={o} /><PoChips pos={o.purchaseOrders} /></div>,
                <Td key="date">{formatDateTime(o.createdAt)}</Td>,
                isDemo ? <span key="act" className="text-xs text-muted-foreground">예시</span> : <OrderStatusActions key="act" {...orderActionProps(o, { isAdmin: false, isSeller: true, isFacilityOwner: false })} />,
              ];
            })}
          />
        </div>
      )}
    </div>
  );
}
