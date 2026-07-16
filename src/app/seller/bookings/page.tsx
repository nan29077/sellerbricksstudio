import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { ActionButton } from "@/components/action-button";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import { CalendarPlus, Radio } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_BOOKINGS: any[] = [
  {
    id: "bk1", status: "APPROVED", purpose: "뷰티 제품 라이브 방송", expectedProducts: 12,
    startAt: new Date("2026-06-20T14:00:00"), endAt: new Date("2026-06-20T17:00:00"),
    rejectReason: null, liveSession: null,
    facility: { id:"d1", name:"강남 프리미엄 라이브 스튜디오", type:"STUDIO", region:"서울", address:"서울 강남구 테헤란로 123", basePrice:150000, thumbnailUrl:null, rating:4.9, status:"APPROVED" },
  },
  {
    id: "bk2", status: "PENDING", purpose: "식품 라이브 커머스", expectedProducts: 8,
    startAt: new Date("2026-06-22T10:00:00"), endAt: new Date("2026-06-22T12:00:00"),
    rejectReason: null, liveSession: null,
    facility: { id:"d2", name:"마포구 대형 물류 창고", type:"WAREHOUSE", region:"서울", address:"서울 마포구 홍대입구로 45", basePrice:80000, thumbnailUrl:null, rating:4.8, status:"APPROVED" },
  },
  {
    id: "bk3", status: "COMPLETED", purpose: "패션 신상품 방송", expectedProducts: 15,
    startAt: new Date("2026-06-10T13:00:00"), endAt: new Date("2026-06-10T16:00:00"),
    rejectReason: null, liveSession: { id: "ls1" },
    facility: { id:"d3", name:"성수 인더스트리얼 스튜디오", type:"STUDIO", region:"서울", address:"서울 성동구 성수이로 12길 34", basePrice:120000, thumbnailUrl:null, rating:4.7, status:"APPROVED" },
  },
  {
    id: "bk4", status: "REJECTED", purpose: "전자제품 방송", expectedProducts: 6,
    startAt: new Date("2026-06-05T11:00:00"), endAt: new Date("2026-06-05T13:00:00"),
    rejectReason: "해당 날짜에 이미 예약이 가득 찼습니다.", liveSession: null,
    facility: { id:"d5", name:"판교 IT 테크 스튜디오", type:"STUDIO", region:"경기", address:"경기 성남시 분당구 판교로 78", basePrice:100000, thumbnailUrl:null, rating:4.5, status:"APPROVED" },
  },
];

export default async function SellerBookings() {
  const user = await requireRole(["SELLER"]);

  let bookings: any[] = [];
  try {
    bookings = await prisma.booking.findMany({
      where: { sellerId: user.id },
      orderBy: { startAt: "desc" },
      include: { facility: true, liveSession: true },
    });
    if (bookings.length === 0) bookings = DUMMY_BOOKINGS;
  } catch {
    bookings = DUMMY_BOOKINGS;
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader
        title="내 예약"
        description="신청한 예약을 확인하고 라이브 세션을 만드세요."
        action={
          <Link href="/seller/bookings/new">
            <Button><CalendarPlus className="h-4 w-4 mr-1" />예약 신청</Button>
          </Link>
        }
      />

      {bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-10 w-10" />}
          title="예약이 없습니다"
          description="창고나 스튜디오를 예약해 라이브 방송을 진행하세요."
          action={<Link href="/seller/bookings/new"><Button>예약 신청하기</Button></Link>}
        />
      ) : (
        <div className="space-y-3 mt-4">
          {bookings.map((b) => {
            const st = BOOKING_STATUS[b.status] ?? { label: b.status, tone: "gray" as const };
            return (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <span className="text-xs text-muted-foreground">{b.facility?.type === "STUDIO" ? "스튜디오" : "창고"}</span>
                      </div>
                      <p className="font-bold text-navy truncate">{b.facility?.name ?? "시설"}</p>
                      <p className="text-sm text-muted-foreground">{b.facility?.region} · {formatDateTime(b.startAt)}</p>
                      <p className="text-xs text-muted-foreground mt-1">목적: {b.purpose}</p>
                      {b.rejectReason && (
                        <p className="text-xs text-red-600 mt-1">거절 사유: {b.rejectReason}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {b.status === "APPROVED" && !b.liveSession && (
                        <Link href={`/seller/live-sessions?bookingId=${b.id}`}>
                          <Button size="sm" variant="outline" className="border-brand-300 text-brand-700">
                            <Radio className="h-3.5 w-3.5 mr-1" />라이브 세션 만들기
                          </Button>
                        </Link>
                      )}
                      {b.status === "PENDING" && (
                        <ActionButton
                          url={`/api/bookings/${b.id}/cancel`}
                          method="PATCH"
                          confirmText="예약을 취소하시겠습니까?"
                          size="sm"
                          variant="outline"
                        >취소</ActionButton>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
