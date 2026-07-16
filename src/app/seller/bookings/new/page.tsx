import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { BookingForm } from "@/components/booking-form";

export const dynamic = "force-dynamic";

const DUMMY_FACILITIES = [
  { id: "d1", name: "강남 프리미엄 라이브 스튜디오", type: "STUDIO",    region: "서울 강남구", openTime: "09:00", closeTime: "22:00" },
  { id: "d2", name: "마포구 대형 물류 창고",          type: "WAREHOUSE", region: "서울 마포구", openTime: "08:00", closeTime: "20:00" },
  { id: "d3", name: "성수 인더스트리얼 스튜디오",    type: "STUDIO",    region: "서울 성동구", openTime: "09:00", closeTime: "21:00" },
  { id: "d4", name: "인천 냉장-냉동 전문 창고",       type: "WAREHOUSE", region: "인천 남동구", openTime: "08:00", closeTime: "20:00" },
];

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: { facilityId?: string };
}) {
  await requireRole(["SELLER"]);

  let facilities: typeof DUMMY_FACILITIES = [];
  try {
    const db = await prisma.facility.findMany({
      where: { status: "APPROVED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, region: true, openTime: true, closeTime: true },
    });
    const mapped = db.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type as string,
      region: f.region,
      openTime: f.openTime ?? "09:00",
      closeTime: f.closeTime ?? "22:00",
    }));
    facilities = mapped.length > 0 ? mapped : DUMMY_FACILITIES;
  } catch {
    facilities = DUMMY_FACILITIES;
  }

  return (
    <div>
      <PageHeader title="예약 신청" description="방송할 창고/스튜디오와 시간을 선택하세요." />
      <BookingForm facilities={facilities} defaultFacilityId={searchParams.facilityId} />
    </div>
  );
}
