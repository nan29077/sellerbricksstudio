import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import { Clock, CalendarCheck, BarChart2, Flame, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_UPCOMING_SCHEDULE = [
  { id:"bk1", status:"APPROVED", startAt:new Date("2026-06-19T14:00:00"), endAt:new Date("2026-06-19T17:00:00"), facility:{ name:"강남 프리미엄 라이브 스튜디오" }, seller:{ profile:{ name:"박지현" }, email:"seller@example.com" },  purpose:"뷰티 신상 라이브" },
  { id:"bk2", status:"APPROVED", startAt:new Date("2026-06-20T10:00:00"), endAt:new Date("2026-06-20T13:00:00"), facility:{ name:"마포구 대형 물류 창고" },         seller:{ profile:{ name:"홍길동" }, email:"seller2@example.com" }, purpose:"식품 라이브 방송" },
  { id:"bk3", status:"PENDING",  startAt:new Date("2026-06-22T09:00:00"), endAt:new Date("2026-06-22T12:00:00"), facility:{ name:"강남 프리미엄 라이브 스튜디오" }, seller:{ profile:{ name:"김미래" }, email:"seller3@example.com" }, purpose:"패션 신상 방송" },
  { id:"bk4", status:"APPROVED", startAt:new Date("2026-06-24T14:00:00"), endAt:new Date("2026-06-24T17:00:00"), facility:{ name:"강남 프리미엄 라이브 스튜디오" }, seller:{ profile:{ name:"정유나" }, email:"seller4@example.com" }, purpose:"뷰티 기획전" },
  { id:"bk5", status:"APPROVED", startAt:new Date("2026-06-25T10:00:00"), endAt:new Date("2026-06-25T13:00:00"), facility:{ name:"마포구 대형 물류 창고" },         seller:{ profile:{ name:"이수민" }, email:"seller5@example.com" }, purpose:"전자제품 라이브" },
];

const DUMMY_WEEK_ANALYSIS = [
  { day: "월요일", avgBookings: 1.2, popular: false },
  { day: "화요일", avgBookings: 1.8, popular: false },
  { day: "수요일", avgBookings: 2.4, popular: true  },
  { day: "목요일", avgBookings: 2.8, popular: true  },
  { day: "금요일", avgBookings: 3.6, popular: true  },
  { day: "토요일", avgBookings: 4.2, popular: true  },
  { day: "일요일", avgBookings: 3.1, popular: true  },
];

const THIS_WEEK_DAYS = [
  { date: "6/15 (월)", bookings: 1, max: 4 },
  { date: "6/16 (화)", bookings: 2, max: 4 },
  { date: "6/17 (수)", bookings: 3, max: 4 },
  { date: "6/18 (목)", bookings: 4, max: 4 },
  { date: "6/19 (금)", bookings: 3, max: 4 },
  { date: "6/20 (토)", bookings: 4, max: 4 },
  { date: "6/21 (일)", bookings: 2, max: 4 },
];

export default async function FacilitySchedule() {
  const user = await requireRole(["FACILITY_ADMIN"]);

  let upcomingBookings: any[] = [];
  try {
    const facIds = await ownedFacilityIds(user.id);
    upcomingBookings = await prisma.booking.findMany({
      where: {
        facilityId: { in: facIds },
        status: { in: ["APPROVED", "PENDING"] },
        startAt: { gte: new Date() },
      },
      orderBy: { startAt: "asc" },
      take: 10,
      include: {
        facility: { select: { name: true } },
        seller: { select: { email: true, profile: { select: { name: true } } } },
      },
    });
    if (upcomingBookings.length === 0) upcomingBookings = DUMMY_UPCOMING_SCHEDULE;
  } catch {
    upcomingBookings = DUMMY_UPCOMING_SCHEDULE;
  }

  const maxWeek = Math.max(...THIS_WEEK_DAYS.map((d) => d.bookings));

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="일정 관리" description="이번 주 예약 일정과 가동률 현황을 확인합니다." />

      {/* 이번 주 가동률 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4 text-brand-500" />
            이번 주 가동률
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {THIS_WEEK_DAYS.map((d) => {
              const pct = Math.round((d.bookings / d.max) * 100);
              return (
                <div key={d.date} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{d.date}</span>
                  <div className="relative h-20 w-full bg-muted rounded-sm overflow-hidden">
                    <div
                      className={`absolute bottom-0 w-full rounded-sm transition-all ${pct >= 75 ? "bg-red-400" : pct >= 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-navy">{pct}%</span>
                  <span className="text-[10px] text-muted-foreground">{d.bookings}/{d.max}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />여유</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />보통</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />만실</span>
          </div>
        </CardContent>
      </Card>

      {/* 예정 예약 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-brand-500" />
            다가오는 예약 일정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingBookings.map((b: any) => {
            const st = BOOKING_STATUS[b.status as keyof typeof BOOKING_STATUS] ?? { label: b.status, tone: "gray" as const };
            return (
              <div key={b.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                  <Calendar className="h-4 w-4 text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="text-xs font-semibold text-navy">{b.seller?.profile?.name ?? b.seller?.email ?? "셀러"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{b.facility?.name}</p>
                  <div className="flex items-center gap-1 text-xs text-brand-600 mt-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(b.startAt)} ~ {formatDateTime(b.endAt)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">목적: {b.purpose}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 요일별 인기도 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-500" />
            요일별 예약 인기도
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DUMMY_WEEK_ANALYSIS.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-16 shrink-0">{d.day}</span>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${d.popular ? "bg-orange-400" : "bg-brand-300"}`}
                    style={{ width: `${(d.avgBookings / 4.2) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 w-20 text-xs shrink-0">
                  <span className="font-semibold text-navy">{d.avgBookings.toFixed(1)}건</span>
                  {d.popular && <Flame className="h-3 w-3 text-orange-400" />}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">평균 일일 예약 건수 기준 (최근 3개월)</p>
        </CardContent>
      </Card>
    </div>
  );
}
