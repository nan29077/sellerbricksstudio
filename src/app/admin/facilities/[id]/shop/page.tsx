import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFacilityPageConfig } from "@/lib/facility-page";
import { FacilityPageEditor } from "@/components/facility/facility-page-editor";
import { PageHeader } from "@/components/layout/dashboard-widgets";

export default async function AdminFacilityShop({ params }: { params: { id: string } }) {
  await requireRole(["SUPER_ADMIN"]);
  const facility = await prisma.facility.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, type: true, region: true, address: true, description: true },
  });
  if (!facility) notFound();
  const config = await getFacilityPageConfig(facility);
  return <div className="space-y-5">
    <PageHeader title={`${facility.name} 샵 관리`} description="공간별 샵 디자인, 소개와 상품 노출을 관리합니다." />
    <FacilityPageEditor facility={facility} initialConfig={config} />
  </div>;
}
