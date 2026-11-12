import { prisma } from "@/lib/prisma";
import { PO_CHIP_INCLUDE } from "@/components/brand/po-chips";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { Pagination } from "@/components/list/pagination";
import { pageOf, sp, type SP } from "@/lib/list";
import { getPolicy } from "@/lib/policy";
import { OrderCardList } from "@/components/order-card-list";
import { OrderFilterTabs } from "@/components/order-filter-tabs";
import { ORDER_ACTION_INCLUDE } from "@/lib/order-action-props";
import { orderFilterWhere } from "@/lib/order-view";

export const dynamic = "force-dynamic";
const BASE = "/seller/orders";

export default async function SellerOrders({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  const status = sp(searchParams, "status") ?? "";
  const q = sp(searchParams, "q") ?? "";
  const { page, size, skip, take } = pageOf(searchParams, 30);

  let orders: any[] = [];
  let total = 0;
  const policy = await getPolicy();
  try {
    const where = {
      sellerId: user.id, ...orderFilterWhere(status),
      ...(q && { AND: [{ OR: [{ orderNo: { contains: q, mode: "insensitive" as const } }, { buyerName: { contains: q } }] }] }),
    };
    [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, orderBy: { createdAt: "desc" }, skip, take,
        include: { liveSession: { select: { title: true } }, facility: { select: { name: true } }, purchaseOrders: PO_CHIP_INCLUDE, ...ORDER_ACTION_INCLUDE },
      }),
      prisma.order.count({ where }),
    ]);
  } catch {
    orders = []; // DB 오류 시 빈 목록 (예시 주문은 보여 주지 않는다)
  }
  const actor = { isAdmin: false, isSeller: true, isFacilityOwner: false };

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="주문 현황" description="라이브 방송에서 발생한 주문과 배송 진행 상태를 확인합니다. 배송은 상품을 출고하는 창고(스튜디오) 또는 브랜드가 처리합니다." />
      <OrderFilterTabs base={BASE} params={searchParams} current={status} q={q} />

      {orders.length === 0 ? (
        <EmptyState title="주문이 없습니다" description={status || q ? "조건에 맞는 주문이 없습니다." : "라이브 방송 후 주문이 들어오면 여기서 확인할 수 있습니다."} />
      ) : (
        <OrderCardList orders={orders} actor={actor} piiRetentionDays={policy.piiRetentionDays} show={{ place: true }} />
      )}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
