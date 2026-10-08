import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatKRW } from "@/lib/utils";
import {
  Building2, CalendarCheck, Users, BarChart3,
  Clock, ArrowRight, CheckCircle2, MapPin, Star,
  ExternalLink, TrendingUp, Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

async function getDashboardData(userId: string) {
  const facIds = await ownedFacilityIds(userId);
  if (facIds.length === 0) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    facilities,
    bkTotal,
    bkPending,
    sellerGroups,
    upcoming,
    weeklyRaw,
    monthlyBookings,
    sellerRankRaw,
    thisMonthRevenue,
  ] = await Promise.all([
    // 시설 목록
    prisma.facility.findMany({
      where: { id: { in: facIds } },
      select: { id: true, name: true, region: true, type: true },
    }),
    // 누적 예약 수
    prisma.booking.count({ where: { facilityId: { in: facIds } } }),
    // 승인 대기 예약 수
    prisma.booking.count({ where: { facilityId: { in: facIds }, status: "PENDING" } }),
    // 이용 셀러 수 (unique)
    prisma.booking.groupBy({ by: ["sellerId"], where: { facilityId: { in: facIds } } }),
    // 다가오는 승인된 예약 5건
    prisma.booking.findMany({
      where: {
        facilityId: { in: facIds },
        status: "APPROVED",
        startAt: { gte: now },
      },
      orderBy: { startAt: "asc" },
      take: 5,
      include: {
        facility: { select: { name: true } },
        seller: { select: { email: true, profile: { select: { name: true } } } },
      },
    }),
    // 주간 예약 (7일치)
    prisma.booking.findMany({
      where: { facilityId: { in: facIds }, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    // 이번 달 시설별 예약 수 (가동률 계산용)
    prisma.booking.groupBy({
      by: ["facilityId"],
      where: { facilityId: { in: facIds }, createdAt: { gte: monthStart } },
      _count: { id: true },
    }),
    // 셀러 예약 랭킹 (누적 예약 건수 + 라이브 세션 매출)
    prisma.booking.groupBy({
      by: ["sellerId"],
      where: { facilityId: { in: facIds } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    // 이번 달 총 매출 (시설 이용 라이브에서 발생한 주문 기준)
    prisma.order.aggregate({
      where: {
        liveSession: { facilityId: { in: facIds } },
        status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
        createdAt: { gte: monthStart },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  // 주간 차트 데이터 계산
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return {
      day: DAY_LABELS[d.getDay()],
      value: weeklyRaw.filter((b) => b.createdAt >= d && b.createdAt < next).length,
    };
  });

  // 시설별 이번 달 예약 건수 맵
  const monthlyMap = new Map<string, number>();
  for (const g of monthlyBookings) {
    monthlyMap.set(g.facilityId, g._count.id);
  }
  // 가동률 = 이번 달 예약 / 30 * 100 (최대 100%)
  const facilitiesWithUtil = facilities.map((f) => {
    const cnt = monthlyMap.get(f.id) ?? 0;
    const pct = Math.min(100, Math.round((cnt / 30) * 100));
    return { ...f, monthlyBookings: cnt, utilizationPct: pct };
  });

  // 셀러 랭킹 — 이름 병렬 조회
  const sellerIds = sellerRankRaw.map((r) => r.sellerId);
  const sellerProfiles = await prisma.user.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, email: true, profile: { select: { name: true } } },
  });
  const profileMap = new Map(sellerProfiles.map((u) => [u.id, u]));
  const sellerRank = sellerRankRaw.map((r) => ({
    sellerId: r.sellerId,
    name: profileMap.get(r.sellerId)?.profile?.name ?? profileMap.get(r.sellerId)?.email ?? "셀러",
    bookings: r._count.id,
  }));

  return {
    facilities: facilitiesWithUtil,
    totalBookings: bkTotal,
    pendingBookings: bkPending,
    totalSellers: sellerGroups.length,
    upcoming,
    chartData,
    sellerRank,
    thisMonthRevenue: thisMonthRevenue._sum.totalAmount ?? 0,
  };
}

export default async function FacilityDashboard() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    data = await getDashboardData(user.id);
  } catch { /* fallback */ }

  const facilities = data?.facilities ?? [];
  const totalBookings = data?.totalBookings ?? 0;
  const pendingBookings = data?.pendingBookings ?? 0;
  const totalSellers = data?.totalSellers ?? 0;
  const upcoming = data?.upcoming ?? [];
  const chartData = data?.chartData ?? [
    { day: "일", value: 0 }, { day: "월", value: 0 }, { day: "화", value: 0 },
    { day: "수", value: 0 }, { day: "목", value: 0 }, { day: "금", value: 0 },
    { day: "토", value: 0 },
  ];
  const sellerRank = data?.sellerRank ?? [];
  const thisMonthRevenue = data?.thisMonthRevenue ?? 0;

  const maxWeekly = Math.max(...chartData.map((d) => d.value), 1);
  const weeklyTotal = chartData.reduce((s, d) => s + d.value, 0);
  const maxRankBookings = sellerRank[0]?.bookings ?? 1;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <PageHeader title={`안녕하세요, ${user.name}님`} description="창고/스튜디오 관리 대시보드" />
        <Link href="/facility/bookings" className="hidden sm:block">
          <Button variant="outline">예약 관리</Button>
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
            <p className="text-xs text-amber-600">셀러의 예약 요청을 확인하고 승인하세요.</p>
          </div>
          <Link href="/facility/bookings">
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700">
              확인하기
            </Button>
          </Link>
        </div>
      )}

      {/* 핵심 지표 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="등록 시설" value={`${facilities.length}개`} sub="창고/스튜디오" icon={Building2} />
        <StatCard label="총 예약" value={`${totalBookings}건`} sub={`대기 ${pendingBookings}건`} icon={CalendarCheck} />
        <StatCard label="이용 셀러" value={`${totalSellers}명`} sub="누적 이용자" icon={Users} />
        <StatCard
          label="이번 달 매출"
          value={thisMonthRevenue > 0 ? formatKRW(thisMonthRevenue) : "—"}
          sub="라이브 주문 기준"
          icon={Wallet}
        />
      </div>

      {/* 주간 예약 차트 + 셀러 랭킹 */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* 이번 주 일별 예약 — 실 DB */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-500" />
                <h3 className="font-bold text-navy">이번 주 일별 예약</h3>
              </div>
              <span className="text-xs text-muted-foreground">총 {weeklyTotal}건</span>
            </div>
            <div className="flex items-end gap-2 h-28">
              {chartData.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {d.value > 0 ? `${d.value}건` : ""}
                  </span>
                  <div
                    className="w-full bg-brand-500 rounded-t-sm hover:bg-brand-600 transition-all"
                    style={{ height: `${Math.max(d.value > 0 ? 8 : 2, (d.value / maxWeekly) * 100)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 셀러 이용 랭킹 — 실 DB */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-navy">셀러 이용 랭킹</h3>
              </div>
              <Link href="/facility/bookings" className="text-xs text-brand-600 flex items-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {sellerRank.length > 0 ? (
              <div className="space-y-3">
                {sellerRank.map((s, i) => (
                  <div key={s.sellerId} className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                        i === 0
                          ? "bg-amber-100 text-amber-700"
                          : i === 1
                            ? "bg-gray-100 text-gray-600"
                            : "bg-orange-50 text-orange-600"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-navy truncate">{s.name}</span>
                        <span className="text-sm font-bold text-brand-600 shrink-0 ml-2">
                          {s.bookings}회
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${(s.bookings / maxRankBookings) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">예약 횟수 기준</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                이용 데이터가 없습니다
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 보유 시설 현황 — 실 DB (가동률 = 이번 달 예약 기준) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-navy">보유 시설 현황</h3>
          <Link href="/facility/profile" className="text-xs text-brand-600 flex items-center gap-1">
            시설 관리 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {facilities.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              등록된 시설이 없습니다.{" "}
              <Link href="/facility/profile" className="text-brand-600 underline">
                시설을 등록하세요
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {facilities.map((f: any) => {
              const pct = f.utilizationPct ?? 0;
              const barColor =
                pct >= 80 ? "bg-red-400" : pct >= 50 ? "bg-amber-400" : "bg-emerald-400";
              return (
                <Link key={f.id} href={`/facility/profile`}>
                  <Card className="hover:shadow-md transition cursor-pointer">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 shrink-0">
                          <Building2 className="h-5 w-5 text-brand-500" />
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
                          <p className="text-xs text-muted-foreground mt-0.5">
                            이번 달 예약 {f.monthlyBookings}건
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">이번 달 가동률</span>
                          <span className="text-xs font-bold text-navy">{pct}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 다가오는 예약 — 실 DB */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-brand-500" />
              <h3 className="font-bold text-navy">다가오는 예약</h3>
            </div>
            <Link href="/facility/bookings" className="text-xs text-brand-600 flex items-center gap-1">
              전체보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
              다가오는 예약이 없습니다
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b: any) => {
                const sellerName =
                  b.seller?.profile?.name ?? b.seller?.email ?? "셀러";
                const facName = b.facility?.name ?? "시설";
                return (
                  <div
                    key={b.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{sellerName}</p>
                      <p className="text-xs text-muted-foreground">{facName}</p>
                      <div className="flex items-center gap-1 text-xs text-brand-600 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(b.startAt)}
                      </div>
                      {b.purpose && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          목적: {b.purpose}
                        </p>
                      )}
                    </div>
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
                  sellerbricks.co.kr에서 시설·셀러·정산을 통합 관리하세요
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
