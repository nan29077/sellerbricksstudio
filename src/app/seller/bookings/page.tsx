import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { FilterBar } from "@/components/list/filter-bar";
import { StatusTabs } from "@/components/list/status-tabs";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { Kpi } from "@/components/list/charts";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { SellerBookingActions } from "@/components/booking/seller-booking-actions";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime, formatKRW } from "@/lib/utils";
import { addMonths, hhmm, hoursBetween, kstStartOfMonth, parseMonth } from "@/lib/kst";
import { dateRange, pageOf, sp, withParams, type SP } from "@/lib/list";
import { CalendarPlus, CalendarDays, List, Clock, Wallet, Star, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/seller/bookings";

export default async function SellerBookings({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  const view = sp(searchParams, "view") === "calendar" ? "calendar" : "list";
  const status = sp(searchParams, "status");
  const q = sp(searchParams, "q");
  const { page, size, skip, take } = pageOf(searchParams, 15);

  const where: Prisma.BookingWhereInput = {
    sellerId: user.id,
    ...(status && { status: status as any }),
    ...(dateRange(searchParams) && { startAt: dateRange(searchParams) }),
    ...(q && { OR: [
      { facility: { name: { contains: q, mode: "insensitive" } } },
      { purpose: { contains: q, mode: "insensitive" } },
      { facility: { region: { contains: q, mode: "insensitive" } } },
    ] }),
  };
  const month = parseMonth(sp(searchParams, "month"));
  const monthStart = kstStartOfMonth(new Date());

  const [rows, total, grouped, upcoming, spentAll, spentMonth, calRows, reviewPending] = await Promise.all([
    view === "list" ? prisma.booking.findMany({
      where, orderBy: { startAt: "desc" }, skip, take,
      include: { facility: { select: { id: true, name: true, type: true, region: true, address: true, basePrice: true, contactPhone: true } }, review: true },
    }) : Promise.resolve([]),
    prisma.booking.count({ where }),
    prisma.booking.groupBy({ by: ["status"], where: { sellerId: user.id }, _count: true }),
    prisma.booking.findFirst({ where: { sellerId: user.id, status: "APPROVED", startAt: { gte: new Date() } }, orderBy: { startAt: "asc" }, include: { facility: { select: { name: true } } } }),
    prisma.booking.aggregate({ where: { sellerId: user.id, status: { in: ["APPROVED", "COMPLETED"] } }, _sum: { totalPrice: true } }),
    prisma.booking.aggregate({ where: { sellerId: user.id, status: { in: ["APPROVED", "COMPLETED"] }, startAt: { gte: monthStart, lt: addMonths(monthStart, 1) } }, _sum: { totalPrice: true }, _count: true }),
    view === "calendar" ? prisma.booking.findMany({
      where: { ...where, startAt: { gte: month, lt: addMonths(month, 1) } }, include: { facility: { select: { name: true } } },
    }) : Promise.resolve([]),
    prisma.booking.count({ where: { sellerId: user.id, status: "COMPLETED", review: null } }),
  ]);

  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const all = grouped.reduce((s, g) => s + g._count, 0);
  const tabs = [{ value: "", label: "전체", count: all }, ...Object.entries(BOOKING_STATUS).map(([k, v]) => ({ value: k, label: v.label, count: counts[k] ?? 0 }))];

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader
        title="예약 관리"
        description="신청한 예약의 진행 상황, 이용료, 리뷰를 한 곳에서 관리하세요."
        action={<Link href="/seller/bookings/new"><Button><CalendarPlus className="h-4 w-4" />예약 신청</Button></Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="다가오는 예약" value={upcoming ? formatDateTime(upcoming.startAt) : "없음"} sub={upcoming?.facility.name} icon={Clock} tone="blue" />
        <Kpi label="승인 대기" value={`${counts.PENDING ?? 0}건`} sub="창고(스튜디오) 확인 중" icon={CalendarDays} tone="brand" />
        <Kpi label="이번 달 이용료" value={formatKRW(spentMonth._sum.totalPrice ?? 0)} sub={`${spentMonth._count}건 확정`} icon={Wallet} tone="green" />
        <Kpi label="누적 이용료" value={formatKRW(spentAll._sum.totalPrice ?? 0)} sub={`이용 완료 ${counts.COMPLETED ?? 0}건`} icon={CheckCircle2} tone="navy" />
      </div>

      {reviewPending > 0 && (
        <Link href={withParams(BASE, {}, { status: "COMPLETED" })} className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <Star className="h-5 w-5 fill-brand-500 text-brand-500" />이용 완료 후 리뷰를 남기지 않은 예약이 {reviewPending}건 있습니다. 리뷰를 남겨 다른 셀러에게 도움을 주세요.
        </Link>
      )}

      <StatusTabs base={BASE} params={searchParams} tabs={tabs} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[
          { type: "search", key: "q", placeholder: "창고(스튜디오)명 · 지역 · 방송 목적" },
          { type: "date", key: "from", label: "이용일 시작" },
          { type: "date", key: "to", label: "이용일 끝" },
        ]} />
        <div className="flex gap-2">
          <Link href={withParams(BASE, searchParams, { view: undefined })}><Button size="sm" variant={view === "list" ? "secondary" : "outline"}><List className="h-4 w-4" />목록</Button></Link>
          <Link href={withParams(BASE, searchParams, { view: "calendar", page: undefined })}><Button size="sm" variant={view === "calendar" ? "secondary" : "outline"}><CalendarDays className="h-4 w-4" />달력</Button></Link>
          {view === "list" && (
            <CsvButton filename="내_예약목록" headers={["상태", "창고(스튜디오)", "시작", "종료", "이용시간", "이용료", "인원", "목적"]}
              rows={rows.map((b) => [BOOKING_STATUS[b.status]?.label, b.facility.name, formatDateTime(b.startAt), formatDateTime(b.endAt), hoursBetween(b.startAt, b.endAt), b.totalPrice, b.headcount, b.purpose])} label="CSV" />
          )}
        </div>
      </div>

      {view === "calendar" ? (
        <MonthCalendar month={month} base={BASE} params={searchParams}
          events={calRows.map((b) => ({ id: b.id, start: b.startAt, end: b.endAt, label: b.facility.name, tone: BOOKING_STATUS[b.status]?.tone, href: withParams(BASE, {}, { q: b.facility.name }) }))} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<CalendarPlus className="h-10 w-10" />} title={status || q ? "조건에 맞는 예약이 없습니다" : "아직 예약이 없습니다"}
          description="창고나 스튜디오를 예약해 라이브 방송을 준비하세요."
          action={<Link href="/seller/bookings/new"><Button>예약 신청하기</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {rows.map((b) => {
            const st = BOOKING_STATUS[b.status] ?? { label: b.status, tone: "gray" as const };
            const h = hoursBetween(b.startAt, b.endAt);
            return (
              <Card key={b.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <Badge tone={b.facility.type === "STUDIO" ? "purple" : "blue"}>{b.facility.type === "STUDIO" ? "스튜디오" : "창고"}</Badge>
                        <span className="text-xs text-muted-foreground">신청 {formatDateTime(b.createdAt)}</span>
                      </div>
                      <Link href={`/facilities/${b.facility.id}`} className="block truncate text-lg font-bold text-navy hover:underline">{b.facility.name}</Link>
                      <p className="text-sm text-slate-600">{formatDateTime(b.startAt)} ~ {hhmm(b.endAt)} <span className="text-muted-foreground">· {h}시간</span></p>
                      <p className="text-xs text-muted-foreground">{b.facility.region} · {b.facility.address}{b.facility.contactPhone && b.status === "APPROVED" ? ` · ☎ ${b.facility.contactPhone}` : ""}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-slate-600">
                        {b.purpose && <span>목적: {b.purpose}</span>}
                        {b.headcount && <span>인원: {b.headcount}명</span>}
                        {b.expectedProducts && <span className="max-w-md truncate">상품: {b.expectedProducts}</span>}
                      </div>
                      {b.requestNote && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-slate-600">요청사항: {b.requestNote}</p>}
                      {b.rejectReason && b.status === "REJECTED" && <p className="text-xs font-semibold text-red-600">거절 사유: {b.rejectReason}</p>}
                      {b.cancelReason && b.status === "CANCELLED" && <p className="text-xs text-slate-500">취소 사유: {b.cancelReason}</p>}
                      {b.review && (
                        <div className="mt-1 rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2 text-xs">
                          <span className="font-bold text-brand-700">{"★".repeat(b.review.rating)}{"☆".repeat(5 - b.review.rating)}</span> <span className="text-slate-600">{b.review.content}</span>
                          {b.review.reply && <p className="mt-1 text-slate-500">↳ 답글: {b.review.reply}</p>}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                      <p className="text-right text-lg font-extrabold text-navy">{formatKRW(b.totalPrice)}<span className="block text-[11px] font-normal text-muted-foreground">{formatKRW(b.facility.basePrice)}/시간 기준</span></p>
                      <SellerBookingActions
                        booking={{ id: b.id, status: b.status, startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString(), facilityId: b.facility.id, facilityName: b.facility.name, address: b.facility.address, purpose: b.purpose }}
                        review={b.review ? { id: b.review.id, rating: b.review.rating, content: b.review.content, reply: b.review.reply } : null}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
        </div>
      )}
    </div>
  );
}
