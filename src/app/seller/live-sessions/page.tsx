import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { LiveSessionCreate } from "@/components/live-session-create";
import { LIVE_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import { DEMO_LIVE_SESSIONS } from "@/lib/live-demo";
import { Radio, Package, ShoppingBag } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_SESSIONS: any[] = DEMO_LIVE_SESSIONS;

export default async function SellerLiveSessions({ searchParams }: { searchParams: { bookingId?: string } }) {
  const user = await requireRole(["SELLER"]);
  if (!(await getSettings()).liveEnabled) redirect("/seller/dashboard");

  let approvedBookings: any[] = [];
  let sessions: any[] = [];

  try {
    [approvedBookings, sessions] = await Promise.all([
      prisma.booking.findMany({
        where: { sellerId: user.id, status: "APPROVED", liveSession: null },
        include: { facility: true },
        orderBy: { startAt: "asc" },
      }),
      prisma.liveSession.findMany({
        where: { sellerId: user.id },
        orderBy: { createdAt: "desc" },
        include: { facility: true, _count: { select: { products: true, orders: true } } },
      }),
    ]);
    if (sessions.length === 0) sessions = DUMMY_SESSIONS;
  } catch {
    sessions = DUMMY_SESSIONS;
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="라이브 세션" description="방송 세션을 만들고 상품번호를 관리하세요." />

      {approvedBookings.length > 0 && (
        <Card className="mb-6 border-brand-200 bg-brand-50/50">
          <CardContent className="pt-6">
            <p className="font-semibold text-navy mb-3">승인된 예약으로 라이브 세션 만들기</p>
            <LiveSessionCreate
              bookings={approvedBookings.map((b) => ({
                id: b.id,
                facilityId: b.facilityId,
                facilityName: b.facility.name,
                startAt: b.startAt.toISOString(),
              }))}
              defaultBookingId={searchParams.bookingId}
            />
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          icon={<Radio className="h-10 w-10" />}
          title="라이브 세션이 없습니다"
          description="승인된 예약으로 세션을 만들어보세요."
          action={<Link href="/seller/bookings"><Button>예약 보기</Button></Link>}
        />
      ) : (
        <div className="space-y-3 mt-4">
          {sessions.map((ls: any) => {
            const st = LIVE_STATUS[ls.status as keyof typeof LIVE_STATUS] ?? { label: ls.status, tone: "gray" as const };
            return (
              <Card key={ls.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {ls.status === "LIVE" && (
                          <span className="text-[10px] font-bold text-red-600 animate-pulse">LIVE</span>
                        )}
                      </div>
                      <p className="font-bold text-navy truncate">{ls.title}</p>
                      <p className="text-sm text-muted-foreground">{ls.facility?.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDateTime(ls.scheduledStart)}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />{ls._count.products}개 상품
                        </span>
                        <span className="flex items-center gap-1">
                          <ShoppingBag className="h-3.5 w-3.5" />{ls._count.orders}건 주문
                        </span>
                      </div>
                    </div>
                    <Link href={`/seller/live-sessions/${ls.id}`}>
                      <Button size="sm" variant="outline">상세보기</Button>
                    </Link>
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
