import { prisma } from "@/lib/prisma";
import { PO_CHIP_INCLUDE } from "@/components/brand/po-chips";
import { requireRole } from "@/lib/auth";
import { operableFacilityIds } from "@/lib/facility-owner";
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
const BASE = "/facility/orders";

export default async function FacilityOrders({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  const status = sp(searchParams, "status") ?? "";
  const q = sp(searchParams, "q") ?? "";
  const { page, size, skip, take } = pageOf(searchParams, 30);

  let orders: any[] = [];
  let total = 0;
  const policy = await getPolicy();
  try {
    const facIds = await operableFacilityIds(user);
    const where = {
      facilityId: { in: facIds }, ...orderFilterWhere(status),
      ...(q && { AND: [{ OR: [{ orderNo: { contains: q, mode: "insensitive" as const } }, { buyerName: { contains: q } }] }] }),
    };
    [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, orderBy: { createdAt: "desc" }, skip, take,
        include: {
          liveSession: { select: { title: true } },
          seller: { select: { profile: { select: { name: true } } } },
          purchaseOrders: PO_CHIP_INCLUDE,
          ...ORDER_ACTION_INCLUDE,
        },
      }),
      prisma.order.count({ where }),
    ]);
  } catch {
    orders = []; // DB 오류 시 빈 목록 (예시 주문은 보여 주지 않는다)
  }
  const actor = { isAdmin: false, isSeller: false, isFacilityOwner: true };

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="주문 현황" description="공간 방송의 주문입니다. '상품 · 배송지 보기'에서 보낼 상품과 배송지를 확인하고 발송(운송장 입력)해 주세요. 브랜드 직배송 상품은 브랜드가 보냅니다." />
      <OrderFilterTabs base={BASE} params={searchParams} current={status} q={q} exportHref="/api/orders/export" />

      {orders.length === 0 ? (
        <EmptyState title="주문이 없습니다" description={status || q ? "조건에 맞는 주문이 없습니다." : "라이브 방송 후 주문 내역이 여기에 표시됩니다."} />
      ) : (
        <OrderCardList orders={orders} actor={actor} piiRetentionDays={policy.piiRetentionDays} show={{ seller: true }} />
      )}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
