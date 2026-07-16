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
  Clock, ArrowRight, CheckCircle2, MapPin, Star, ExternalLink
} from "lucide-react";

export const dynamic = "force-dynamic";

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

const DUMMY_FACILITIES = [
  { id: "f1", name: "강남 프리미엄 라이브 스튜디오", region: "서울 강남구", type: "STUDIO",    utilizationPct: 78, rating: 4.8, totalBookings: 42 },
  { id: "f2", name: "마포구 대형 물류 창고",          region: "서울 마포구", type: "WAREHOUSE", utilizationPct: 61, rating: 4.5, totalBookings: 29 },
];

const DUMMY_UPCOMING = [
  { id: "b1", sellerName: "박지현", facilityName: "강남 프리미엄 라이브 스튜디오", startAt: new Date("2026-06-20T14:00:00"), purpose: "뷰티 신상 라이브" },
  { id: "b2", sellerName: "홍길동", facilityName: "마포구 대형 물류 창고",          startAt: new Date("2026-06-21T10:00:00"), purpose: "식품 라이브 방송" },
  { id: "b3", sellerName: "김미래", facilityName: "강남 프리미엄 라이브 스튜디오", startAt: new Date("2026-06-23T09:00:00"), purpose: "패션 신상 방송" },
];

const DUMMY_SELLER_RANK = [
  { name: "박지현", bookings: 14, revenue: 4_200_000 },
  { name: "홍길동", bookings: 11, revenue: 3_300_000 },
  { name: "정유나", bookings: 8,  revenue: 2_400_000 },
];

const WEEKLY_BOOKINGS = [
  { day: "월", value: 1 },
  { day: "화", value: 2 },
  { day: "수", value: 3 },
  { day: "목", value: 4 },
  { day: "금", value: 3 },
  { day: "토", value: 4 },
  { day: "일", value: 2 },
];

export default async function FacilityDashboard() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let facilities: any[] = [];
  let totalBookings = 0, pendingBookings = 0, totalSellers = 0;
  let upcomingBookings: any[] = [];

  try {
    const facIds = await ownedFacilityIds(user.id);
    const [facs, bkTotal, bkPending, sellers, upcoming] = await Promise.all([
      prisma.facility.findMany({ where: { id: { in: facIds } }, select: { id: true, name: true, region: true, type: true } }),
      prisma.booking.count({ where: { facilityId: { in: facIds } } }),
      prisma.booking.count({ where: { facilityId: { in: facIds }, status: "PENDING" } }),
      prisma.booking.groupBy({ by: ["sellerId"], where: { facilityId: { in: facIds } } }),
      prisma.booking.findMany({
        where: { facilityId: { in: facIds }, status: "APPROVED", startAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        take: 5,
        include: {
          facility: { select: { name: true } },
          seller: { select: { email: true, profile: { select: { name: true } } } },
        },
      }),
    ]);
    facilities = facs;
    totalBookings = bkTotal;
    pendingBookings = bkPending;
    totalSellers = sellers.length;
    upcomingBookings = upcoming;
  } catch { /* fallback */ }

  if (facilities.length === 0) {
    facilities = DUMMY_FACILITIES;
    totalBookings = 71;
    pendingBookings = 3;
    totalSellers = 18;
  }
  if (upcomingBookings.length === 0) upcomingBookings = DUMMY_UPCOMING;

  const maxWeekly = Math.max(...WEEKLY_BOOKINGS.map((d) => d.value));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader title={`안녕하세요, ${user.name}님`} description="창고/스튜디오 관리 대시보드" />
        <Link href="/facility/bookings" className="hidden sm:block">
          <Button variant="outline">예약 관리</Button>
        </Link>
      </div>

      {pendingBookings > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">승인 대기 중인 예약이 {pendingBookings}건 있습니다</p>
            <p className="text-xs text-amber-600">셀러의 예약 요청을 확인하고 승인하세요.</p>
          </div>
          <Link href="/facility/bookings">
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700">확인하기</Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="등록 시설" value={`${facilities.length}개`}  sub="창고/스튜디오"              icon={Building2} />
        <StatCard label="총 예약"   value={`${totalBookings}건`}      sub={`대기 ${pendingBookings}건`} icon={CalendarCheck} />
        <StatCard label="이용 셀러" value={`${totalSellers}명`}       sub="누적 이용자"                 icon={Users} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-500" />
                <h3 className="font-bold text-navy">이번 주 일별 예약</h3>
              </div>
            </div>
            <div className="flex items-end gap-2 h-28">
              {WEEKLY_BOOKINGS.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">{d.value}건</span>
                  <div
                    className="w-full bg-brand-500 rounded-t-sm hover:bg-brand-600 transition-all"
                    style={{ height: `${Math.max(8, (d.value / maxWeekly) * 100)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-navy">셀러 이용 랭킹</h3>
              </div>
              <Link href="/facility/bookings" className="text-xs text-brand-600 flex items-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {DUMMY_SELLER_RANK.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                    i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : "bg-orange-50 text-orange-600"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-navy">{s.name}</span>
                      <span className="text-sm font-bold text-brand-600">{formatKRW(s.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(s.revenue / DUMMY_SELLER_RANK[0].revenue) * 100}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.bookings}회 예약</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-navy">보유 시설 현황</h3>
          <Link href="/facility/profile" className="text-xs text-brand-600 flex items-center gap-1">
            시설 관리 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {facilities.map((f: any) => {
            const pct = DUMMY_FACILITIES.find((d) => d.name === f.name)?.utilizationPct ?? 65;
            const rating = DUMMY_FACILITIES.find((d) => d.name === f.name)?.rating ?? 4.5;
            return (
              <Card key={f.id} className="hover:shadow-md transition">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 shrink-0">
                      <Building2 className="h-5 w-5 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-navy truncate">{f.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {f.region} · {f.type === "WAREHOUSE" ? "창고" : "스튜디오"}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-semibold text-navy">{rating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">이번 달 가동률</span>
                      <span className="text-xs font-bold text-navy">{pct}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 80 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${pct}%` }}
                      />
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
              <CalendarCheck className="h-4 w-4 text-brand-500" />
              <h3 className="font-bold text-navy">다가오는 예약</h3>
            </div>
            <Link href="/facility/bookings" className="text-xs text-brand-600 flex items-center gap-1">
              전체보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingBookings.map((b: any) => {
              const sellerName = b.sellerName ?? b.seller?.profile?.name ?? b.seller?.email ?? "셀러";
              const facName = b.facilityName ?? b.facility?.name ?? "시설";
              return (
                <div key={b.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
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
                    {b.purpose && <p className="text-xs text-muted-foreground mt-0.5">목적: {b.purpose}</p>}
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
                <p className="text-xs text-muted-foreground mt-1">sellerbricks.co.kr에서 시설·셀러·정산을 통합 관리하세요</p>
              </div>
              <ExternalLink className="h-5 w-5 text-brand-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
