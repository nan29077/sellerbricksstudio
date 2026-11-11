import { PageHeader } from "@/components/layout/dashboard-widgets";
import { PurchaseOrderList } from "@/components/brand/po-list";
import { requireRole } from "@/lib/auth";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";

export default async function AdminPurchaseOrders({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  return (
    <div className="space-y-5">
      <PageHeader title="발주 관리" description="모든 브랜드 발주서를 확인하고 상태 · 운송장 · 메모를 수정합니다. 취소 · 반품은 사유와 함께 기록됩니다." />
      <PurchaseOrderList scope={{}} actor="ADMIN" base="/admin/purchase-orders" params={searchParams} />
    </div>
  );
}
