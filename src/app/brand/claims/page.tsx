import { PageHeader } from "@/components/layout/dashboard-widgets";
import { PurchaseOrderList } from "@/components/brand/po-list";
import { requireRole } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";

// 브랜드: 취소 · 반품 · 교환 (출고 불가 요청 포함)
export default async function BrandClaims({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["BRAND_ADMIN"]);
  return (
    <div className="space-y-5">
      <PageHeader title="취소 · 반품 · 교환" description="출고 불가를 알린 발주, 취소·반품된 발주, 교환 재발송한 발주를 모아 봅니다. 반품 상품을 받으면 '반품 수령 확인'을, 교환은 운송장을 입력해 주세요." />
      {user.id === "demo-brand" ? <p>데이터베이스 연결이 필요합니다.</p> : (
        <PurchaseOrderList actor="BRAND" base="/brand/claims" params={searchParams} scope={{
          AND: [
            { brandShop: brandShopWhere(user.id) },
            { OR: [{ status: { in: ["CANCELLED", "RETURNED"] } }, { cancelRequestedAt: { not: null } }, { exchangeTrackingNumber: { not: "" } }] },
          ],
        }} />
      )}
    </div>
  );
}
