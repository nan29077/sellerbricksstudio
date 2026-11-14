import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kpi } from "@/components/list/charts";
import { CsvButton } from "@/components/list/csv-button";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { BOOKING_STATUS } from "@/lib/status";
import { formatKRW } from "@/lib/utils";
import { addMonths, hoursBetween, kstParts, parseMonth, monthKey } from "@/lib/kst";
import { sp, withParams, type SP } from "@/lib/list";
import { cn } from "@/lib/utils";
import { Building2, Gauge, Wallet, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/farm-reservations";
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

export default async function AdminFacilityOccupancy({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const month = parseMonth(sp(searchParams, "month"));
  const next = addMonths(month, 1);
  const fid = sp(searchParams, "facility");
  const sort = sp(searchParams, "sort") ?? "util";
  const p = kstParts(month);
  const days = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();

  const [facilities, bookings, blackouts] = await Promise.all([
    prisma.facility.findMany({ where: { status: "APPROVED" }, include: { slots: { where: { isActive: true } } } }),
    prisma.booking.findMany({ where: { startAt: { gte: month, lt: next } }, include: { facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } } }),
    prisma.facilityBlackoutDate.findMany({ where: { date: { gte: month, lt: next } } }),
  ]);

  const stats = facilities.map((f) => {
    const bs = bookings.filter((b) => b.facilityId === f.id);
    const ok = bs.filter((b) => ["APPROVED", "COMPLETED"].includes(b.status));
    const bookedH = ok.reduce((s, b) => s + hoursBetween(b.startAt, b.endAt), 0);
    const off = blackouts.filter((b) => b.facilityId === f.id).length;
    // 월 운영 가능 시간: 슬롯이 있으면 요일별 슬롯 합 × 해당 요일 수, 없으면 운영시간 × 일수
    let openH = 0;
    for (let d = 1; d <= days; d++) {
      const wd = new Date(Date.UTC(p.year, p.month - 1, d)).getUTCDay();
      openH += f.slots.length ? f.slots.filter((s) => s.weekday === wd).reduce((a, s) => a + (toMin(s.endTime) - toMin(s.startTime)) / 60, 0)
        : Math.max(0, (toMin(f.closeTime ?? "22:00") - toMin(f.openTime ?? "09:00")) / 60);
    }
    openH = Math.max(0, openH * (1 - off / days));
    const cancelled = bs.filter((b) => ["CANCELLED", "REJECTED"].includes(b.status)).length;
    return {
      f, count: ok.length, pending: bs.filter((b) => b.status === "PENDING").length, bookedH, openH,
      util: openH ? Math.min(100, Math.round((bookedH / openH) * 100)) : 0,
      revenue: ok.reduce((s, b) => s + b.totalPrice, 0), cancelRate: bs.length ? Math.round((cancelled / bs.length) * 100) : 0,
    };
  }).sort((a, b) => sort === "revenue" ? b.revenue - a.revenue : sort === "pending" ? b.pending - a.pending : b.util - a.util);

  const totalOpen = stats.reduce((s, x) => s + x.openH, 0);
  const totalBooked = stats.reduce((s, x) => s + x.bookedH, 0);
  const calRows = bookings.filter((b) => (!fid || b.facilityId === fid) && b.status !== "CANCELLED");

  return (
    <div className="space-y-5">
      <PageHeader title="공간별 예약 현황" description={`${p.year}년 ${p.month}월 공간별 가동률 · 매출 · 대기 건을 비교합니다.`}
        action={<div className="flex items-center gap-2">
          <Link href={withParams(BASE, searchParams, { month: monthKey(addMonths(month, -1)) })} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">◀ 이전 달</Link>
          <Link href={withParams(BASE, searchParams, { month: monthKey(addMonths(month, 1)) })} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">다음 달 ▶</Link>
        </div>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="운영 중 공간" value={`${facilities.length}곳`} icon={Building2} tone="navy" />
        <Kpi label="평균 가동률" value={`${totalOpen ? Math.round((totalBooked / totalOpen) * 100) : 0}%`} sub={`${Math.round(totalBooked)}h / ${Math.round(totalOpen)}h`} icon={Gauge} tone="brand" />
        <Kpi label="월 거래액" value={formatKRW(stats.reduce((s, x) => s + x.revenue, 0))} sub={`${stats.reduce((s, x) => s + x.count, 0)}건`} icon={Wallet} tone="green" />
        <Kpi label="처리 대기" value={`${stats.reduce((s, x) => s + x.pending, 0)}건`} icon={AlertCircle} tone="red" />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">공간 비교</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {[["util", "가동률순"], ["revenue", "매출순"], ["pending", "대기순"]].map(([k, l]) => (
              <Link key={k} href={withParams(BASE, searchParams, { sort: k })} className={cn("hit rounded-full border px-3 py-1 text-xs font-semibold", sort === k ? "border-navy bg-navy text-white" : "border-border bg-white")}>{l}</Link>
            ))}
            <CsvButton label="CSV" filename={`창고별현황_${monthKey(month)}`} headers={["공간", "확정건", "대기", "이용시간", "운영시간", "가동률(%)", "매출", "취소·거절률(%)"]}
              rows={stats.map((s) => [s.f.name, s.count, s.pending, Math.round(s.bookedH), Math.round(s.openH), s.util, s.revenue, s.cancelRate])} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm rtable">
            <thead><tr className="border-b text-left text-xs text-slate-500">{["공간", "가동률", "확정", "대기", "매출", "취소·거절", ""].map((h) => <th key={h} className="px-2 py-2 font-bold">{h}</th>)}</tr></thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.f.id} className={cn("border-b border-[#F0ECE6] last:border-0", fid === s.f.id && "bg-brand-50/60")}>
                  <td data-label="공간" className="px-2 py-2.5"><p className="font-semibold text-navy">{s.f.name}</p><p className="text-[11px] text-slate-400">{s.f.region} · {formatKRW(s.f.basePrice)}/h</p></td>
                  <td data-label="가동률" className="w-48 px-2 py-2.5">
                    <div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-slate-100"><div className={cn("h-full rounded-full", s.util >= 70 ? "bg-emerald-500" : s.util >= 30 ? "bg-brand-500" : "bg-red-400")} style={{ width: `${s.util}%` }} /></div><span className="w-10 text-right text-xs font-bold">{s.util}%</span></div>
                  </td>
                  <td data-label="확정" className="px-2 py-2.5 text-xs">{s.count}건 · {Math.round(s.bookedH)}h</td>
                  <td data-label="대기" className="px-2 py-2.5">{s.pending ? <Badge tone="yellow">{s.pending}</Badge> : <span className="text-xs text-slate-400">0</span>}</td>
                  <td data-label="매출" className="px-2 py-2.5 text-xs font-bold">{formatKRW(s.revenue)}</td>
                  <td data-label="취소·거절" className="px-2 py-2.5 text-xs">{s.cancelRate}%</td>
                  <td data-label="" className="px-2 py-2.5 text-right"><Link href={withParams(BASE, searchParams, { facility: fid === s.f.id ? undefined : s.f.id })} className="text-xs font-semibold text-brand-700 hover:underline">{fid === s.f.id ? "전체 보기" : "달력 보기"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-extrabold text-navy">{fid ? `${facilities.find((f) => f.id === fid)?.name ?? ""} 일정` : "전체 예약 일정"}</h2>
        <MonthCalendar month={month} base={BASE} params={searchParams} maxPerDay={4}
          blackouts={fid ? blackouts.filter((b) => b.facilityId === fid) : []}
          events={calRows.map((b) => ({ id: b.id, start: b.startAt, end: b.endAt, label: fid ? (b.seller.profile?.name ?? b.seller.email) : b.facility.name, tone: BOOKING_STATUS[b.status]?.tone, href: `/admin/bookings?facility=${b.facilityId}` }))} />
      </div>
    </div>
  );
}
