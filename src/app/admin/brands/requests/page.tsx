import { requireRole } from "@/lib/auth";
import type { SP } from "@/lib/list";
import { BrandRequestList } from "@/components/shop/brand-request-list";
import { PageHeader } from "@/components/layout/dashboard-widgets";

export default async function AllBrandRequests({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  return <div className="space-y-5">
    <PageHeader title="전체 브랜드 신청" description="모든 브랜드사의 공급 신청과 샘플 주문을 확인합니다." />
    <BrandRequestList base="/admin/brands/requests" scope={{}} params={searchParams} manager />
  </div>;
}
