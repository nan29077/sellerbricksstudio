import { requireRole } from "@/lib/auth";
import { BrandDirectory } from "@/components/shop/brand-directory";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";
export const metadata = { title: "브랜드샵 둘러보기 | 스토리지마켓" };

// 창고 운영 화면 안의 브랜드샵 둘러보기 (메인 브랜드샵과 같은 내용)
export default async function FacilityBrands({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN", "MANAGER"]);
  return <BrandDirectory searchParams={searchParams} base="/facility/brands" dashboard />;
}
