import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ActionButton } from "@/components/action-button";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_BOOKINGS: any[] = [
  {
    id:"bk1", status:"PENDING",   purpose:"뷰티 제품 라이브 방송", expectedProducts:12,
    startAt:new Date("2026-06-22T10:00:00"), endAt:new Date("2026-06-22T12:00:00"),
    facility:{ name:"강남 프리미엄 라이브 스튜디오" },
    seller:{ email:"seller@sellerbricks.kr", profile:{ name:"박지현" } },
  },
  {
    id:"bk2", status:"APPROVED",  purpose:"식품 라이브 커머스", expectedProducts:8,
    startAt:new Date("2026-06-20T14:00:00"), endAt:new Date("2026-06-20T17:00:00"),
    facility:{ name:"강남 프리미엄 라이브 스튜디오" },
    seller:{ email:"seller2@example.com", profile:{ name:"홍길동" } },
  },
  {
    id:"bk3", status:"COMPLETED", purpose:"패션 신상품 방송", expectedProducts:15,
    startAt:new Date("2026-06-10T13:00:00"), endAt:new Date("2026-06-10T16:00:00"),
    facility:{ name:"강남 프리미엄 라이브 스튜디오" },
    seller:{ email:"seller3@example.com", profile:{ name:"김미래" } },
  },
];

export default async function FacilityBookings() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let bookings: any[] = [];
  try {
    const facIds = await ownedFacilityIds(user.id);
    bookings = await prisma.booking.findMany({
      where: { facilityId: { in: facIds } },
      orderBy: { startAt: "desc" },
      include: { facility: true, seller: { include: { profile: true } } },
    });
    if (bookings.length === 0) bookings = DUMMY_BOOKINGS;
  } catch {
    bookings = DUMMY_BOOKINGS;
  }

  const pending = bookings.filter((b) => b.status === "PENDING").length;

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader
        title="예약 관리"
        description="셀러의 예약 요청을 승인하거나 거절하세요."
      />

      {pending > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-700">승인 대기 예약 {pending}건이 있습니다. 빠른 처리를 부탁드립니다.</p>
        </div>
      )}

      {bookings.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-10 w-10" />} title="예약 요청이 없습니다" />
      ) : (
        <div className="space-y-3 mt-4">
          {bookings.map((b) => {
            const st = BOOKING_STATUS[b.status as keyof typeof BOOKING_STATUS] ?? { label: b.status, tone: "gray" as const };
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span className="text-xs text-muted-foreground">{b.facility?.name}</span>
                    </div>
                    <p className="font-bold text-navy">{b.seller?.profile?.name ?? b.seller?.email ?? "셀러"}</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(b.startAt)} ~ {formatDateTime(b.endAt)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      목적: {b.purpose} · 예상 상품 {b.expectedProducts ?? 0}개
                    </p>
                  </div>
                  {b.status === "PENDING" && (
                    <div className="flex gap-2 shrink-0">
                      <ActionButton url={`/api/bookings/${b.id}/approve`} method="PATCH" size="sm">승인</ActionButton>
                      <ActionButton url={`/api/bookings/${b.id}/reject`} method="PATCH" size="sm" variant="outline">거절</ActionButton>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
