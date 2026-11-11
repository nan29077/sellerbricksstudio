import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi, ProgressRow } from "@/components/list/charts";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { SlotEditor, BlackoutEditor, TimeBlockEditor } from "@/components/facility/schedule-editor";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";
import { addDays, addMonths, dateKey, hhmm, hoursBetween, kstParts, kstStartOfDay, parseMonth, WEEKDAYS } from "@/lib/kst";
import { sp, withParams, type SP } from "@/lib/list";
import { cn } from "@/lib/utils";
import { BarChart2, CalendarClock, Flame, Gauge, Clock, CalendarOff, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/facility/schedule";
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

export default async function FacilitySchedule({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["FACILITY_ADMIN"]);
  const ids = await ownedFacilityIds(user.id);
  const facilities = await prisma.facility.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "asc" }, include: { slots: true } });
  if (facilities.length === 0) {
    return <div><PageHeader title="일정 관리" /><EmptyState icon={<Building2 className="h-10 w-10" />} title="등록된 창고(스튜디오)가 없습니다" action={<Link href="/facility/register" className="text-sm font-semibold text-brand-700">창고(스튜디오) 등록하기</Link>} /></div>;
  }
  const f = facilities.find((x) => x.id === sp(searchParams, "facility")) ?? facilities[0];
  const month = parseMonth(sp(searchParams, "month"));
  const today = kstStartOfDay(new Date());
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [monthBookings, weekBookings, blackouts, history, timeBlocks] = await Promise.all([
    prisma.booking.findMany({ where: { facilityId: f.id, status: { in: ["PENDING", "APPROVED", "COMPLETED"] }, startAt: { gte: month, lt: addMonths(month, 1) } }, include: { seller: { select: { email: true, profile: { select: { name: true } } } } } }),
    prisma.booking.findMany({ where: { facilityId: f.id, status: { in: ["PENDING", "APPROVED"] }, startAt: { gte: today, lt: addDays(today, 7) } }, orderBy: { startAt: "asc" }, include: { seller: { select: { email: true, profile: { select: { name: true } } } } } }),
    prisma.facilityBlackoutDate.findMany({ where: { facilityId: f.id, date: { gte: addMonths(month, -1) } }, orderBy: { date: "asc" } }),
    prisma.booking.findMany({ where: { facilityId: f.id, status: { in: ["APPROVED", "COMPLETED"] }, startAt: { gte: addDays(today, -90), lt: today } }, select: { startAt: true, endAt: true } }),
    prisma.facilityTimeBlock.findMany({ where: { facilityId: f.id, endAt: { gte: today } }, orderBy: { startAt: "asc" }, take: 100 }),
  ]);

  // 하루 운영 가능 시간(분): 요일 슬롯이 있으면 슬롯 합, 없으면 운영시간
  const openMin = (d: Date) => {
    const wd = kstParts(d).weekday;
    if (blackouts.some((b) => dateKey(b.date) === dateKey(d))) return 0;
    const active = f.slots.filter((s) => s.isActive);
    if (active.length) return active.filter((s) => s.weekday === wd).reduce((a, s) => a + toMin(s.endTime) - toMin(s.startTime), 0);
    return Math.max(0, toMin(f.closeTime ?? "22:00") - toMin(f.openTime ?? "09:00"));
  };
  const weekStats = week.map((d) => {
    const booked = weekBookings.filter((b) => dateKey(b.startAt) === dateKey(d) && b.status === "APPROVED").reduce((a, b) => a + hoursBetween(b.startAt, b.endAt) * 60, 0);
    const pending = weekBookings.filter((b) => dateKey(b.startAt) === dateKey(d) && b.status === "PENDING").length;
    const open = openMin(d);
    return { d, booked, open, pending, pct: open ? Math.min(100, Math.round((booked / open) * 100)) : 0 };
  });
  const weekOpen = weekStats.reduce((a, s) => a + s.open, 0);
  const weekBooked = weekStats.reduce((a, s) => a + s.booked, 0);

  const byWeekday = WEEKDAYS.map((w, i) => ({ w, n: history.filter((b) => kstParts(b.startAt).weekday === i).length }));
  const byHour = Array.from({ length: 24 }, (_, h) => history.filter((b) => kstParts(b.startAt).hour === h).length);
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const maxWd = Math.max(1, ...byWeekday.map((x) => x.n));
  const upcomingOff = blackouts.filter((b) => b.date >= today);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="일정 관리" description="요일별 운영 시간대와 휴무일을 설정하고, 가동률과 인기 시간대를 확인하세요." />

      {facilities.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {facilities.map((x) => (
            <Link key={x.id} href={withParams(BASE, {}, { facility: x.id })} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", x.id === f.id ? "border-navy bg-navy text-white" : "border-[#E5E0D6] bg-white text-slate-600")}>{x.name}</Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="향후 7일 가동률" value={`${weekOpen ? Math.round((weekBooked / weekOpen) * 100) : 0}%`} sub={`${Math.round(weekBooked / 60)}h / ${Math.round(weekOpen / 60)}h`} icon={Gauge} tone="brand" />
        <Kpi label="7일 내 예약" value={`${weekBookings.length}건`} sub={`대기 ${weekBookings.filter((b) => b.status === "PENDING").length}건`} icon={CalendarClock} tone="blue" />
        <Kpi label="인기 요일 (90일)" value={byWeekday.some((x) => x.n) ? `${byWeekday.reduce((a, b) => (b.n > a.n ? b : a)).w}요일` : "-"} icon={Flame} tone="red" />
        <Kpi label="인기 시작 시간" value={history.length ? `${peakHour}시` : "-"} sub={`최근 90일 ${history.length}건 기준`} icon={Clock} tone="navy" />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart2 className="h-4 w-4 text-brand-500" />향후 7일 가동률</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekStats.map((s) => {
              const p = kstParts(s.d);
              return (
                <div key={s.d.toISOString()} className="flex flex-col items-center gap-1">
                  <span className={cn("text-[11px] font-semibold", p.weekday === 0 ? "text-red-500" : p.weekday === 6 ? "text-blue-600" : "text-slate-600")}>{p.month}/{p.day}({WEEKDAYS[p.weekday]})</span>
                  <div className="relative h-24 w-full overflow-hidden rounded-lg bg-slate-100">
                    {s.open === 0 ? <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-400">휴무</span>
                      : <div className={cn("absolute bottom-0 w-full", s.pct >= 80 ? "bg-red-400" : s.pct >= 50 ? "bg-amber-400" : "bg-emerald-400")} style={{ height: `${s.pct}%` }} />}
                  </div>
                  <span className="text-xs font-bold text-navy">{s.open ? `${s.pct}%` : "-"}</span>
                  {s.pending > 0 && <Badge tone="yellow" className="px-1.5 text-[11px]">대기 {s.pending}</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-2">
          <h2 className="text-lg font-extrabold text-navy">월간 일정</h2>
          <MonthCalendar month={month} base={BASE} params={searchParams} blackouts={blackouts}
            events={monthBookings.map((b) => ({ id: b.id, start: b.startAt, end: b.endAt, label: b.seller.profile?.name ?? b.seller.email, tone: BOOKING_STATUS[b.status]?.tone, href: `/facility/bookings?q=${encodeURIComponent(b.seller.email)}` }))} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">7일 내 예약</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {weekBookings.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">예정된 예약이 없습니다.</p> : weekBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                  <Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy">{b.seller.profile?.name ?? b.seller.email}</p><p className="text-[11px] text-muted-foreground">{formatDateTime(b.startAt)} ~ {hhmm(b.endAt)}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Flame className="h-4 w-4 text-orange-500" />요일별 예약 (최근 90일)</CardTitle></CardHeader>
            <CardContent className="space-y-2">{byWeekday.map((x) => <ProgressRow key={x.w} label={`${x.w}요일`} value={x.n} max={maxWd} right={`${x.n}건`} />)}</CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-brand-500" />요일별 운영 시간대 · {f.name}</CardTitle>
          <p className="text-xs text-muted-foreground">기본 운영 시간 {f.openTime ?? "09:00"}~{f.closeTime ?? "22:00"} · 최소 {f.minHours}시간 예약</p>
        </CardHeader>
        <CardContent><SlotEditor facilityId={f.id} slots={f.slots} openTime={f.openTime ?? "09:00"} closeTime={f.closeTime ?? "22:00"} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarOff className="h-4 w-4 text-slate-500" />시간대 예약 막기</CardTitle>
          <p className="text-xs text-muted-foreground">하루 전체가 아니라 일부 시간만 막습니다. 막은 시간은 셀러 예약 화면에 표시되지 않습니다.</p>
        </CardHeader>
        <CardContent><TimeBlockEditor facilityId={f.id} items={timeBlocks.map((b) => ({ id: b.id, label: `${dateKey(b.startAt)} ${hhmm(b.startAt)}~${hhmm(b.endAt)}`, reason: b.reason }))} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarOff className="h-4 w-4 text-red-500" />휴무일</CardTitle></CardHeader>
        <CardContent><BlackoutEditor facilityId={f.id} items={upcomingOff.map((b) => ({ id: b.id, date: dateKey(b.date), reason: b.reason }))} /></CardContent>
      </Card>
    </div>
  );
}
