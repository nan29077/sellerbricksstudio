import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { FacilityPageEditor } from "@/components/facility/facility-page-editor";
import { getFacilityPageConfig } from "@/lib/facility-page";

export const dynamic = "force-dynamic";

export default async function FacilityPageEdit({ params }: { params: { id: string } }) {
  const user = await requireRole(["FACILITY_ADMIN"]);
  let facility = null;
  try {
    facility = await prisma.facility.findFirst({
      where: { id: params.id, ownerId: user.id },
      select: { id: true, name: true, type: true, region: true, address: true, description: true },
    });
  } catch {
    notFound();
  }
  if (!facility) notFound();
  const config = await getFacilityPageConfig(facility);

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader title={`${facility.name} 페이지`} description="배너, 소개 문구, 색상과 노출 섹션을 시설에 맞게 꾸며보세요." />
      <FacilityPageEditor facility={facility} initialConfig={config} />
    </div>
  );
}
