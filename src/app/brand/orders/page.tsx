import { PageHeader } from "@/components/layout/dashboard-widgets";
import { PurchaseOrderList } from "@/components/brand/po-list";
import { BulkShipUpload } from "@/components/brand/bulk-ship-upload";
import { requireRole } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";

export default async function BrandOrders({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["BRAND_ADMIN"]);
  return (
    <div className="space-y-5">
      <PageHeader title="발주서" description="셀러·창고(스튜디오)가 판매한 내 상품의 발주서입니다. 직배송은 확인 후 운송장을 입력하고, 창고 입고 상품은 창고가 출고합니다." />
      {user.id !== "demo-brand" && <BulkShipUpload />}
      {user.id === "demo-brand" ? <p>발주서를 보려면 데이터베이스 연결이 필요합니다.</p>
        : <PurchaseOrderList scope={{ brandShop: brandShopWhere(user.id) }} actor="BRAND" base="/brand/orders" params={searchParams} />}
    </div>
  );
}
