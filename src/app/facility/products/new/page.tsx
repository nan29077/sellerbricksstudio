import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { ProductForm } from "@/components/product-form";
import { EmptyState } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

export default async function NewProduct() {
  const user = await requireRole(["FACILITY_ADMIN"]);
  const facilities = await prisma.facility.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  if (facilities.length === 0) return <EmptyState title="먼저 시설을 등록하세요" description="시설정보 메뉴에서 시설을 등록한 뒤 상품을 추가할 수 있습니다." />;
  return (
    <div>
      <PageHeader title="상품 등록" description="판매가, 재고, 셀러 수수료를 입력하세요." />
      <ProductForm facilities={facilities} />
    </div>
  );
}
