import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatKRW } from "@/lib/utils";
import {
  Briefcase, Building2, MapPin,
  ArrowRight, CalendarDays, ExternalLink, Clock,
  CheckCircle2, Users, TrendingUp, Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

const BOOKING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "승인 대기", color: "bg-yellow-100 text-yellow-700" },
  APPROVED:  { label: "승인됨",   color: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "거절됨",   color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소됨",   color: "bg-gray-100 text-gray-600" },
  COMPLETED: { label: "완료",     color: "bg-blue-100 text-blue-700" },
};

async function getDashboardData(userId: string) {
  const facIds = await managerFacilityIds(userId);
  if (facIds.length === 0) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    facilities,
    totalBookings,
    pendingBookings,
    thisMonthBookings,
    uniqueSellers,
    recentBookings,
    upcomingBookings,
    perFacilityBookings,
    commissionRules,
    thisMonthRevenue,
  ] = await Promise.all([
    // 담당 시설 목록
    prisma.facility.findMany({
      where: { id: { in: facIds } },
      select: { id: true, name: true, region: true, type: true },
    }),
    // 총 예약 수
    prisma.booking.count({ where: { facilityId: { in: facIds } } }),
    // 승인 대기 수
    prisma.booking.count({ where: { facilityId: { in: facIds }, status: "PENDING" } }),
    // 이번 달 예약 수
    prisma.booking.count({
      where: { facilityId: { in: facIds }, createdAt: { gte: monthStart } },
    }),
    // 이용 셀러 수 (unique)
    prisma.booking.groupBy({ by: ["sellerId"], where: { facilityId: { in: facIds } } }),
    // 최근 예약 5건 (완료 또는 전체)
    prisma.booking.findMany({
      where: { facilityId: { in: facIds } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        facility: { select: { name: true } },
        seller: { select: { email: true, profile: { select: { name: true } } } },
      },
    }),
    // 다가오는 승인된 예약 3건
    prisma.booking.findMany({
      where: {
        facilityId: { in: facIds },
        status: "APPROVED",
        startAt: { gte: now },
      },
      orderBy: { startAt: "asc" },
      take: 3,
      include: {
        facility: { select: { name: true } },
        seller: { select: { email: true, profile: { select: { name: true } } } },
      },
    }),
    // 시설별 누적 예약 수
    prisma.booking.groupBy({
      by: ["facilityId"],
      where: { facilityId: { in: facIds } },
      _count: { id: true },
    }),
    // 매니저 커미션 룰
    prisma.managerCommissionRule.findMany({
      where: { managerId: userId },
    }),
    // 이번 달 매출 (담당 시설 라이브에서 발생한 주문)
    prisma.order.aggregate({
      where: {
        liveSession: { facilityId: { in: facIds } },
        status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
        createdAt: { gte: monthStart },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  // 시설별 예약 수 맵
  const perFacMap = new Map<string, number>();
  for (const g of perFacilityBookings) {
    perFacMap.set(g.facilityId, g._count.id);
  }
  const facilitiesWithCount = facilities.map((f) => ({
    ...f,
    bookingCount: perFacMap.get(f.id) ?? 0,
  }));

  return {
    facilities: facilitiesWithCount,
    totalBookings,
    pendingBookings,
    thisMonthBookings,
    totalSellers: uniqueSellers.length,
    recentBookings,
    upcomingBookings,
    commissionRules,
    thisMonthRevenue: thisMonthRevenue._sum.totalAmount ?? 0,
  };
}

export default async function ManagerDashboard() {
  const user = await requireRole(["MANAGER"]);

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    data = await getDashboardData(user.id);
  } catch { /* fallback */ }

  const facilities = data?.facilities ?? [];
  const totalBookings = data?.totalBookings ?? 0;
  const pendingBookings = data?.pendingBookings ?? 0;
  const thisMonthBookings = data?.thisMonthBookings ?? 0;
  const totalSellers = data?.totalSellers ?? 0;
  const recentBookings = data?.recentBookings ?? [];
  const upcomingBookings = data?.upcomingBookings ?? [];
  const commissionRules = data?.commissionRules ?? [];
  const thisMonthRevenue = data?.thisMonthRevenue ?? 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <PageHeader
          title={`안녕하세요, ${user.name}님`}
          description="매니저 대시보드 — 담당 시설 현황을 확인하세요"
        />
        <Link href="/manager/facilities" className="hidden sm:block">
          <Button variant="outline">시설 관리</Button>
        </Link>
      </div>

      {/* 알림 배너: 승인 대기 */}
      {pendingBookings > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              승인 대기 중인 예약이 {pendingBookings}건 있습니다
            </p>
            <p className="text-xs text-amber-600">담당 시설의 예약 요청을 확인해 주세요.</p>
          </div>
          <Link href="/manager/bookings">
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700">
              확인하기
            </Button>
          </Link>
        </div>
      )}

      {/* 핵심 지표 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="담당 시설" value={`${facilities.length}개`} sub="창고/스튜디오" icon={Building2} />
        <StatCard label="총 예약" value={`${totalBookings}건`} sub={`이번 달 +${thisMonthBookings}건`} icon={CalendarDays} />
        <StatCard label="이용 셀러" value={`${totalSellers}명`} sub="누적 이용자" icon={Users} />
        <StatCard
          label="이번 달 매출"
          value={thisMonthRevenue > 0 ? formatKRW(thisMonthRevenue) : "—"}
          sub="라이브 주문 기준"
          icon={Wallet}
        />
      </div>

      {/* 담당 시설 현황 — 실 DB */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-navy">담당 시설 현황</h3>
          <Link href="/manager/facilities" className="text-xs text-brand-600 flex items-center gap-1">
            전체보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {facilities.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              담당 시설이 없습니다
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {facilities.map((f: any) => (
              <Card key={f.id} className="hover:shadow-md transition">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 shrink-0">
                      <Building2 className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-navy truncate">{f.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {f.region} ·{" "}
                        {f.type === "WAREHOUSE"
                          ? "창고"
                          : f.type === "STUDIO"
                            ? "스튜디오"
                            : f.type}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground">누적 예약</p>
                      <p className="text-sm font-bold text-navy">{f.bookingCount}건</p>
                    </div>
                    <Link href="/manager/bookings" className="block">
                      <div className="rounded-lg bg-brand-50 px-3 py-2 text-center hover:bg-brand-100 transition cursor-pointer">
                        <p className="text-[10px] text-brand-600">예약 관리</p>
                        <p className="text-xs font-semibold text-brand-700">바로가기</p>
                      </div>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 다가오는 예약 + 커미션 규칙 */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* 다가오는 예약 */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-500" />
                <h3 className="font-bold text-navy">다가오는 예약</h3>
              </div>
              <Link href="/manager/bookings" className="text-xs text-brand-600 flex items-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                다가오는 예약이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((b: any) => {
                  const sellerName =
                    b.seller?.profile?.name ?? b.seller?.email ?? "셀러";
                  return (
                    <div key={b.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy">{sellerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.facility?.name ?? "시설"}
                        </p>
                        {b.startAt && (
                          <div className="flex items-center gap-1 text-xs text-brand-600 mt-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(b.startAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 커미션 규칙 */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <h3 className="font-bold text-navy">커미션 규칙</h3>
              </div>
            </div>
            {commissionRules.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
                설정된 커미션 규칙이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {commissionRules.map((r: any) => (
                  <div key={r.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-navy">커미션 규칙</p>
                      <span className="text-sm font-bold text-emerald-600 shrink-0 ml-2">
                        {r.commissionValue}{r.commissionType === "PERCENT" ? "%" : "원"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.commissionType === "PERCENT" ? "정률" : "정액"} 커미션
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 예약 — 실 DB */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-brand-500" />
              <h3 className="font-bold text-navy">최근 예약 내역</h3>
            </div>
            <Link href="/manager/bookings" className="text-xs text-brand-600 flex items-center gap-1">
              전체보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">예약 내역이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {recentBookings.map((b: any) => {
                const sellerName =
                  b.seller?.profile?.name ?? b.seller?.email ?? "셀러";
                const s =
                  BOOKING_STATUS_MAP[b.status] ??
                  { label: b.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{sellerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.facility?.name ?? "시설"} — {formatDate(b.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${s.color}`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 셀러브릭스 플랫폼 바로가기 */}
      <a href="https://sellerbricks.co.kr" target="_blank" rel="noopener noreferrer" className="block">
        <Card className="border border-border bg-white hover:border-brand-400 hover:shadow-md transition-all">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">셀러브릭스 플랫폼 바로가기</p>
                <p className="text-xs text-muted-foreground mt-1">
                  sellerbricks.co.kr에서 시설·셀러를 통합 관리하세요
                </p>
              </div>
              <ExternalLink className="h-5 w-5 text-brand-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
