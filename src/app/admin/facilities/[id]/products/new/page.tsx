import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { ProductForm } from "@/components/product-form";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminNewFacilityProduct({ params }: { params: { id: string } }) {
  await requireRole(["SUPER_ADMIN"]);
  const facility = await prisma.facility.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!facility) notFound();
  return <div className="space-y-5">
    <PageHeader title={`${facility.name} 상품 등록`} description="예약할 때 셀러가 선택할 판매 상품을 등록합니다." />
    <ProductForm facilities={[facility]} returnHref={`/admin/facility-products?facility=${facility.id}`} />
  </div>;
}
