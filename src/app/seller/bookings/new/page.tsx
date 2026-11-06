import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { BookingForm } from "@/components/booking-form";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Warehouse } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: { facilityId?: string; start?: string; end?: string };
}) {
  const user = await requireRole(["SELLER"]);
  const validTime = (value?: string) => value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;

  const [db, favs] = await Promise.all([
    prisma.facility.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, region: true, openTime: true, closeTime: true, basePrice: true, minHours: true, capacity: true, cancelPolicy: true },
    }).catch(() => []),
    prisma.facilityFavorite.findMany({ where: { userId: user.id }, select: { facilityId: true } }).catch(() => []),
  ]);
  // 찜한 창고(스튜디오)를 위로
  const fav = new Set(favs.map((f) => f.facilityId));
  const facilities = [...db].sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id))).map((f) => ({
    ...f, type: f.type as string, name: fav.has(f.id) ? `★ ${f.name}` : f.name,
    openTime: f.openTime ?? "09:00", closeTime: f.closeTime ?? "22:00",
  }));

  return (
    <div>
      <PageHeader title="예약 신청" description="창고/스튜디오와 날짜를 고르면 그날의 예약 현황과 예상 이용료를 바로 확인할 수 있습니다." />
      {facilities.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="h-10 w-10" />}
          title="예약 가능한 창고(스튜디오)가 없습니다"
          description="승인된 창고(스튜디오)가 등록되면 예약할 수 있습니다."
          action={<Link href="/facilities"><Button variant="outline">창고(스튜디오) 둘러보기</Button></Link>}
        />
      ) : (
        <BookingForm
          facilities={facilities}
          defaultFacilityId={facilities.some((f) => f.id === searchParams.facilityId) ? searchParams.facilityId : undefined}
          defaultStart={validTime(searchParams.start)}
          defaultEnd={validTime(searchParams.end)}
        />
      )}
    </div>
  );
}
