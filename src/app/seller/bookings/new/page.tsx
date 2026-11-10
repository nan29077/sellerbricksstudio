import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { BookingWizard, type WizardFacility } from "@/components/booking/booking-wizard";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Package, Warehouse } from "lucide-react";

export const dynamic = "force-dynamic";

type SPx = { facilityId?: string; products?: string; date?: string; start?: string; end?: string; hours?: string };

export default async function NewBookingPage({ searchParams }: { searchParams: SPx }) {
  const user = await requireRole(["SELLER"]);
  const validTime = (v?: string) => (v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined);
  const validDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

  const [db, favs] = await Promise.all([
    prisma.facility.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      select: {
        id: true, name: true, type: true, region: true, address: true, rating: true, thumbnailUrl: true, capacity: true,
        cancelPolicy: true, bookingNotice: true, specialty: true, autoApprove: true, cancelDeadlineHours: true,
        _count: { select: { products: { where: { isSellable: true } } } },
      },
    }).catch(() => []),
    prisma.facilityFavorite.findMany({ where: { userId: user.id }, select: { facilityId: true } }).catch(() => []),
  ]);
  const fav = new Set(favs.map((f) => f.facilityId));
  const facilities: WizardFacility[] = [...db]
    .sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)))
    .map((f) => ({
      id: f.id, name: f.name, type: f.type as string, region: f.region, address: f.address, rating: f.rating, thumbnailUrl: f.thumbnailUrl,
      productCount: f._count.products, autoApprove: f.autoApprove, capacity: f.capacity, cancelPolicy: f.cancelPolicy,
      bookingNotice: f.bookingNotice, specialty: f.specialty, favorite: fav.has(f.id), cancelDeadlineHours: f.cancelDeadlineHours,
    }));

  // ?products=fpId:수량,fpId:수량 (상품 둘러보기에서 넘어온 선택)
  const products: Record<string, number> = {};
  for (const part of (searchParams.products ?? "").split(",").slice(0, 50)) {
    const [id, q] = part.split(":");
    if (id && /^[\w-]{5,40}$/.test(id)) products[id] = Math.max(1, Math.min(100000, Number(q) || 1));
  }
  const start = validTime(searchParams.start);
  const end = validTime(searchParams.end);
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const hours = Number(searchParams.hours) > 0 ? Number(searchParams.hours) : start && end && toMin(end) > toMin(start) ? (toMin(end) - toMin(start)) / 60 : undefined;

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader
        title="예약 신청"
        description="장소 → 판매 상품 → 일정 순서로 고르면 실시간 예약 현황을 확인하며 바로 신청할 수 있습니다. 창고(스튜디오) 이용료는 무료입니다."
        action={<Link href="/seller/products"><Button variant="outline"><Package className="h-4 w-4" />상품부터 둘러보기</Button></Link>}
      />
      {facilities.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="h-10 w-10" />}
          title="예약 가능한 창고(스튜디오)가 없습니다"
          description="승인된 창고(스튜디오)가 등록되면 예약할 수 있습니다."
          action={<Link href="/facilities"><Button variant="outline">창고(스튜디오) 둘러보기</Button></Link>}
        />
      ) : (
        <BookingWizard
          facilities={facilities}
          defaults={{
            facilityId: facilities.some((f) => f.id === searchParams.facilityId) ? searchParams.facilityId : undefined,
            products, date: validDate(searchParams.date), start, hours,
          }}
        />
      )}
    </div>
  );
}
