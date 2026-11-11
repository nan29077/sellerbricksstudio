import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SP } from "@/lib/list";
import { BrandRequestList } from "@/components/shop/brand-request-list";
import { PageHeader } from "@/components/layout/dashboard-widgets";

export default async function AdminShopRequests({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const shop = await prisma.brandShop.findUnique({ where: { id: params.id }, select: { name: true } });
  if (!shop) notFound();
  return <div className="space-y-5">
    <PageHeader title={`${shop.name} 신청 관리`} description="브랜드샵의 공급 신청과 샘플 주문을 처리합니다." />
    <BrandRequestList base={`/admin/brands/${params.id}/requests`} scope={{ product: { shopId: params.id } }} params={searchParams} manager />
  </div>;
}
