import { requireRole } from "@/lib/auth";
import { BrandStorefront } from "@/components/shop/brand-storefront";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";
export const metadata = { title: "브랜드샵 | 스토리지마켓" };

// 셀러 대시보드 안에서 보는 브랜드샵 (메인 브랜드샵과 같은 내용)
export default async function DashboardBrandShop({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  await requireRole(["SELLER"]);
  return <div className="overflow-hidden rounded-3xl border border-[#E9E5DC] shadow-sm"><BrandStorefront id={params.id} searchParams={searchParams} base="/seller/brands" frame="inline" /></div>;
}
