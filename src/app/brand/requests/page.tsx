import { PageHeader } from "@/components/layout/dashboard-widgets";
import { BrandRequestList } from "@/components/shop/brand-request-list";
import { requireRole } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import type { SP } from "@/lib/list";
import { runBrandRequestMaintenance } from "@/lib/brand-request-automation";

export default async function BrandRequests({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["BRAND_ADMIN"]);
  if (user.id !== "demo-brand") await runBrandRequestMaintenance(); // 응대 기한 처리(1분에 한 번만 실제로 돈다)
  return <div className="space-y-5">
    <PageHeader title="브랜드 신청 관리" description="공급 신청과 샘플 주문을 확인하고 입금과 배송 상태를 관리합니다." />
    {user.id === "demo-brand" ? <p>신청 내역을 확인하려면 데이터베이스 연결이 필요합니다.</p> :
      <BrandRequestList base="/brand/requests" scope={{ product: { shop: brandShopWhere(user.id) } }} manager params={searchParams} />}
  </div>;
}
