import Link from "next/link";
import { SquarePlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
      ...(q && { AND: [{ OR: [{ orderNo: { contains: q, mode: "insensitive" as const } }, { buyerName: { contains: q } }, { externalOrderNo: { contains: q } }] }] }),
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
      <PageHeader title="주문서 · 배송 현황" description="내가 작성한 주문서의 발주 · 배송 상태입니다. 운송장이 나오면 판매한 플랫폼에 입력해 주세요. 출고 전에는 취소할 수 있고, 결제한 금액은 결제 수단으로 환불됩니다."
        action={<Link href="/seller/orders/new" className={buttonVariants({ variant: "secondary" })}><SquarePlus className="h-4 w-4" />주문서 작성</Link>} />
      <OrderFilterTabs base={BASE} params={searchParams} current={status} q={q} />

      {orders.length === 0 ? (
        <EmptyState title="주문서가 없습니다" description={status || q ? "조건에 맞는 주문서가 없습니다." : "라이브 플랫폼에서 판매한 뒤 주문서를 작성하면 여기서 발주 · 배송 상태를 확인할 수 있습니다."} />
      ) : (
        <OrderCardList orders={orders} actor={actor} piiRetentionDays={policy.piiRetentionDays} show={{ place: true }} />
      )}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
