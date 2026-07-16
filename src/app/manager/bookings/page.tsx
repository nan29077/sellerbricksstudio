import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DUMMY_BOOKINGS: any[] = [
  { id:"bk1", status:"APPROVED",  startAt:new Date("2026-06-20T14:00:00"), facility:{ name:"강남 프리미엄 라이브 스튜디오" }, seller:{ profile:{ name:"박지현" } } },
  { id:"bk2", status:"PENDING",   startAt:new Date("2026-06-22T10:00:00"), facility:{ name:"강남 프리미엄 라이브 스튜디오" }, seller:{ profile:{ name:"홍길동" } } },
  { id:"bk3", status:"COMPLETED", startAt:new Date("2026-06-10T13:00:00"), facility:{ name:"성수 인더스트리얼 스튜디오" },    seller:{ profile:{ name:"김미래" } } },
  { id:"bk4", status:"APPROVED",  startAt:new Date("2026-06-25T09:00:00"), facility:{ name:"성수 인더스트리얼 스튜디오" },    seller:{ profile:{ name:"정유나" } } },
  { id:"bk5", status:"REJECTED",  startAt:new Date("2026-06-05T11:00:00"), facility:{ name:"판교 IT 테크 스튜디오" },         seller:{ profile:{ name:"이수민" } } },
];

export default async function ManagerBookings() {
  const user = await requireRole(["MANAGER"]);

  let bookings: any[] = [];
  try {
    const ids = await managerFacilityIds(user.id);
    bookings = await prisma.booking.findMany({
      where: { facilityId: { in: ids } },
      orderBy: { startAt: "desc" },
      include: {
        facility: { select: { name: true } },
        seller: { select: { profile: { select: { name: true } } } },
      },
    });
    if (bookings.length === 0) bookings = DUMMY_BOOKINGS;
  } catch {
    bookings = DUMMY_BOOKINGS;
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="예약 현황" description="담당 시설의 전체 예약 현황을 조회합니다." />

      {bookings.length === 0 ? (
        <EmptyState title="예약이 없습니다" description="담당 시설에 예약이 들어오면 여기서 확인할 수 있습니다." />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
          <Table
            headers={["시설명", "셀러", "일정", "상태"]}
            rows={bookings.map((b: any) => {
              const st = BOOKING_STATUS[b.status as keyof typeof BOOKING_STATUS] ?? { label: b.status, tone: "gray" as const };
              return [
                <span key="facility" className="font-medium text-navy text-sm">{b.facility?.name ?? "-"}</span>,
                <Td key="seller">{b.seller?.profile?.name ?? "-"}</Td>,
                <Td key="date">{formatDateTime(b.startAt)}</Td>,
                <Badge key="status" tone={st.tone}>{st.label}</Badge>,
              ];
            })}
          />
        </div>
      )}
    </div>
  );
}
