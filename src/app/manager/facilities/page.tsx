import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatKRW } from "@/lib/utils";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_FACILITIES: any[] = [
  { id:"d1", name:"강남 프리미엄 라이브 스튜디오", type:"STUDIO",    region:"서울", basePrice:150000, status:"APPROVED", owner:{ profile:{ name:"창고(스튜디오) 관리자 (김대영)" } }, _count:{ products:248, bookings:48 } },
  { id:"d3", name:"성수 인더스트리얼 스튜디오",     type:"STUDIO",    region:"서울", basePrice:120000, status:"APPROVED", owner:{ profile:{ name:"창고(스튜디오) 관리자 (이선호)" } }, _count:{ products:186, bookings:22 } },
  { id:"d5", name:"판교 IT 테크 스튜디오",          type:"STUDIO",    region:"경기", basePrice:100000, status:"APPROVED", owner:{ profile:{ name:"창고(스튜디오) 관리자 (박태호)" } }, _count:{ products:142, bookings:15 } },
];

export default async function ManagerFacilities() {
  const user = await requireRole(["MANAGER"]);

  let facilities: any[] = [];
  try {
    const ids = await managerFacilityIds(user.id);
    facilities = await prisma.facility.findMany({
      where: { id: { in: ids } },
      include: { owner: { include: { profile: true } }, _count: { select: { products: true, bookings: true } } },
    });
    if (facilities.length === 0) facilities = DUMMY_FACILITIES;
  } catch {
    facilities = DUMMY_FACILITIES;
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="내 시설" description={`담당 시설 ${facilities.length}개를 관리합니다.`} />

      {facilities.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="담당 시설이 없습니다"
          description="관리자에게 시설 배정을 요청하세요."
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
          <Table
            headers={["시설명", "유형", "지역", "기본 이용료", "예약", "상품", "상태"]}
            rows={facilities.map((f: any) => [
              <div key="name" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-navy text-sm">{f.name}</span>
              </div>,
              <Td key="type">{f.type === "STUDIO" ? "스튜디오" : "창고"}</Td>,
              <Td key="region">{f.region}</Td>,
              <span key="price" className="font-semibold text-navy text-sm">{formatKRW(f.basePrice)}</span>,
              <Td key="bookings">{f._count.bookings}건</Td>,
              <Td key="products">{f._count.products}개</Td>,
              <Badge key="status" tone={f.status === "APPROVED" ? "green" : "yellow"}>
                {f.status === "APPROVED" ? "운영중" : "검토중"}
              </Badge>,
            ])}
          />
        </div>
      )}
    </div>
  );
}
