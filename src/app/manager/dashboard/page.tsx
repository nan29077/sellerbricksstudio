import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  Briefcase, Building2,
  ArrowRight, CalendarDays, ExternalLink
} from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_FACILITIES = [
  { id: "f1", name: "강남 프리미엄 라이브 스튜디오", region: "서울 강남구", bookings: 42 },
  { id: "f2", name: "마포구 대형 물류 창고",          region: "서울 마포구", bookings: 29 },
];

const DUMMY_RECENT_BOOKINGS = [
  { id: "b1", sellerName: "박지현", facilityName: "강남 프리미엄 라이브 스튜디오", date: new Date("2026-06-18") },
  { id: "b2", sellerName: "홍길동", facilityName: "마포구 대형 물류 창고",          date: new Date("2026-06-17") },
  { id: "b3", sellerName: "정유나", facilityName: "강남 프리미엄 라이브 스튜디오", date: new Date("2026-06-16") },
];

export default async function ManagerDashboard() {
  const user = await requireRole(["MANAGER"]);

  let managedFacilities: any[] = [];
  let totalBookings = 0;
  let recentBookings: any[] = [];

  try {
    const facIds = await managerFacilityIds(user.id);
    const [facs, bkCount, recent] = await Promise.all([
      prisma.facility.findMany({
        where: { id: { in: facIds } },
        select: { id: true, name: true, region: true, type: true },
      }),
      prisma.booking.count({ where: { facilityId: { in: facIds } } }),
      prisma.booking.findMany({
        where: { facilityId: { in: facIds }, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          facility: { select: { name: true } },
          seller: { select: { email: true, profile: { select: { name: true } } } },
        },
      }),
    ]);
    managedFacilities = facs;
    totalBookings = bkCount;
    recentBookings = recent;
  } catch { /* fallback */ }

  if (managedFacilities.length === 0) {
    managedFacilities = DUMMY_FACILITIES;
    totalBookings = 71;
  }
  if (recentBookings.length === 0) recentBookings = DUMMY_RECENT_BOOKINGS;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader title={`안녕하세요, ${user.name}님`} description="매니저 대시보드 - 담당 시설 현황을 확인하세요" />
        <Link href="/manager/facilities" className="hidden sm:block">
          <button className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">시설 관리</button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="담당 시설" value={`${managedFacilities.length}개`} sub="창고/스튜디오" icon={Building2} />
        <StatCard label="총 예약"   value={`${totalBookings}건`}            sub="담당 시설 누적" icon={CalendarDays} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-navy">담당 시설 현황</h3>
          <Link href="/manager/facilities" className="text-xs text-brand-600 flex items-center gap-1">
            전체보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {managedFacilities.map((f: any, idx: number) => {
            const extra = DUMMY_FACILITIES[idx] ?? DUMMY_FACILITIES[0];
            return (
              <Card key={f.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 shrink-0">
                      <Building2 className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-navy truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.region}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-xs text-muted-foreground">예약 건수</p>
                      <p className="text-sm font-bold text-navy">{extra.bookings}건</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-brand-500" />
              <h3 className="font-bold text-navy">최근 완료 예약</h3>
            </div>
            <Link href="/manager/bookings" className="text-xs text-brand-600 flex items-center gap-1">
              전체보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentBookings.map((b: any) => {
              const sellerName = b.sellerName ?? b.seller?.profile?.name ?? b.seller?.email ?? "셀러";
              const facName = b.facilityName ?? b.facility?.name ?? "시설";
              return (
                <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy">{sellerName}</p>
                    <p className="text-xs text-muted-foreground">{facName}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(b.date ?? b.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <a
        href="https://sellerbricks.co.kr"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Card className="border border-border bg-white hover:border-brand-400 hover:shadow-md transition-all">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">셀러브릭스 플랫폼 바로가기</p>
                <p className="text-xs text-muted-foreground mt-1">sellerbricks.co.kr에서 시설·셀러를 통합 관리하세요</p>
              </div>
              <ExternalLink className="h-5 w-5 text-brand-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
