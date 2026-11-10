import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { FilterBar } from "@/components/list/filter-bar";
import { StatusTabs } from "@/components/list/status-tabs";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { Kpi } from "@/components/list/charts";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { ManageBookingList } from "@/components/booking/manage-booking-list";
import { toManageBooking } from "@/lib/booking-view";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime, formatKRW } from "@/lib/utils";
import { addDays, addMonths, hoursBetween, kstStartOfDay, kstStartOfMonth, parseMonth } from "@/lib/kst";
import { dateRange, pageOf, sp, withParams, type SP } from "@/lib/list";
import { CalendarDays, List, AlertCircle, CalendarCheck, Wallet, Clock } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/facility/bookings";

export default async function FacilityBookings({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["FACILITY_ADMIN"]);
  const facIds = await ownedFacilityIds(user.id);
  const facilities = await prisma.facility.findMany({ where: { id: { in: facIds } }, select: { id: true, name: true } });
  const view = sp(searchParams, "view") === "calendar" ? "calendar" : "list";
  const status = sp(searchParams, "status");
  const fid = sp(searchParams, "facility");
  const q = sp(searchParams, "q");
  const sort = sp(searchParams, "sort");
  const { page, size, skip, take } = pageOf(searchParams, 20);

  const scope: Prisma.BookingWhereInput = { facilityId: fid && facIds.includes(fid) ? fid : { in: facIds } };
  const where: Prisma.BookingWhereInput = {
    ...scope,
    ...(status && { status: status as any }),
    ...(dateRange(searchParams) && { startAt: dateRange(searchParams) }),
    ...(q && { OR: [
      { seller: { email: { contains: q, mode: "insensitive" } } },
      { seller: { profile: { name: { contains: q, mode: "insensitive" } } } },
      { seller: { profile: { companyName: { contains: q, mode: "insensitive" } } } },
      { purpose: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ] }),
  };
  const today = kstStartOfDay(new Date());
  const month = parseMonth(sp(searchParams, "month"));
  const mStart = kstStartOfMonth(new Date());
  const include = { facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true, phone: true, companyName: true } } } }, products: { orderBy: { createdAt: "asc" as const } } } as const;

  const [rows, total, grouped, todayCount, monthRev, calRows, blackouts, overduePending] = await Promise.all([
    view === "list" ? prisma.booking.findMany({
      where, include, skip, take,
      orderBy: sort === "upcoming" ? { startAt: "asc" } : status === "PENDING" ? { createdAt: "asc" } : { startAt: "desc" },
    }) : Promise.resolve([]),
    prisma.booking.count({ where }),
    prisma.booking.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.booking.count({ where: { ...scope, status: "APPROVED", startAt: { gte: today, lt: addDays(today, 1) } } }),
    prisma.booking.aggregate({ where: { ...scope, status: { in: ["APPROVED", "COMPLETED"] }, startAt: { gte: mStart, lt: addMonths(mStart, 1) } }, _sum: { totalPrice: true }, _count: true }),
    view === "calendar" ? prisma.booking.findMany({ where: { ...where, startAt: { gte: month, lt: addMonths(month, 1) } }, include }) : Promise.resolve([]),
    view === "calendar" ? prisma.facilityBlackoutDate.findMany({ where: { facilityId: scope.facilityId as any, date: { gte: month, lt: addMonths(month, 1) } } }) : Promise.resolve([]),
    prisma.booking.count({ where: { ...scope, status: "PENDING", startAt: { lt: addDays(new Date(), 2) } } }),
  ]);

  // 셀러별 과거 이용 횟수 (첫 이용 셀러 표시용)
  const sellerIds = Array.from(new Set(rows.map((r) => r.sellerId)));
  const hist = sellerIds.length ? await prisma.booking.groupBy({ by: ["sellerId"], where: { ...scope, sellerId: { in: sellerIds }, status: "COMPLETED" }, _count: true }) : [];
  const history = new Map(hist.map((h) => [h.sellerId, h._count]));

  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const all = grouped.reduce((s, g) => s + g._count, 0);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="예약 관리" description="셀러 예약 요청을 승인·거절하고, 이용 완료 처리와 내부 메모로 운영을 관리하세요." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="승인 대기" value={`${counts.PENDING ?? 0}건`} sub={overduePending ? `48시간 내 이용 ${overduePending}건 급함` : "빠른 응답이 재예약률을 높여요"} icon={AlertCircle} tone={overduePending ? "red" : "brand"} />
        <Kpi label="오늘 이용" value={`${todayCount}건`} icon={Clock} tone="blue" />
        <Kpi label="이번 달 확정 예약" value={`${monthRev._count}건`} sub="승인 · 이용 완료 (이용료 무료)" icon={Wallet} tone="green" />
        <Kpi label="완료 처리 대기" value={`${await prisma.booking.count({ where: { ...scope, status: "APPROVED", endAt: { lt: new Date() } } })}건`} sub="이용이 끝난 승인 예약" icon={CalendarCheck} tone="navy" />
      </div>

      <StatusTabs base={BASE} params={searchParams} tabs={[{ value: "", label: "전체", count: all }, ...Object.entries(BOOKING_STATUS).map(([k, v]) => ({ value: k, label: v.label, count: counts[k] ?? 0 }))]} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[
          { type: "search", key: "q", placeholder: "셀러 이름 · 이메일 · 회사 · 목적 · 예약번호" },
          ...(facilities.length > 1 ? [{ type: "select" as const, key: "facility", label: "창고(스튜디오)", options: facilities.map((f) => ({ value: f.id, label: f.name })) }] : []),
          { type: "select", key: "sort", label: "정렬", options: [{ value: "upcoming", label: "이용일 빠른 순" }] },
          { type: "date", key: "from", label: "이용일 시작" },
          { type: "date", key: "to", label: "이용일 끝" },
        ]} />
        <div className="flex gap-2">
          <Link href={withParams(BASE, searchParams, { view: undefined })}><Button size="sm" variant={view === "list" ? "secondary" : "outline"}><List className="h-4 w-4" />목록</Button></Link>
          <Link href={withParams(BASE, searchParams, { view: "calendar", page: undefined })}><Button size="sm" variant={view === "calendar" ? "secondary" : "outline"}><CalendarDays className="h-4 w-4" />달력</Button></Link>
          {view === "list" && <CsvButton label="CSV" filename="예약목록" headers={["예약번호", "상태", "창고(스튜디오)", "셀러", "이메일", "연락처", "시작", "이용시간", "인원", "목적", "판매 예정 상품", "요청사항"]}
            rows={rows.map((b) => [b.code, BOOKING_STATUS[b.status]?.label, b.facility.name, b.seller.profile?.name, b.seller.email, b.seller.profile?.phone, formatDateTime(b.startAt), hoursBetween(b.startAt, b.endAt), b.headcount, b.purpose, b.products.map((p) => `${p.nameSnapshot}×${p.quantity}`).join(" / "), b.requestNote])} />}
        </div>
      </div>

      {view === "calendar" ? (
        <MonthCalendar month={month} base={BASE} params={searchParams} blackouts={blackouts}
          events={calRows.map((b) => ({ id: b.id, start: b.startAt, end: b.endAt, label: b.seller.profile?.name ?? b.seller.email, tone: BOOKING_STATUS[b.status]?.tone }))} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-10 w-10" />} title={status || q ? "조건에 맞는 예약이 없습니다" : "아직 예약 요청이 없습니다"}
          description="창고(스튜디오) 페이지를 꾸미고 운영 시간대를 등록하면 셀러가 더 쉽게 예약할 수 있어요."
          action={<Link href="/facility/schedule"><Button variant="outline">운영 시간대 설정</Button></Link>} />
      ) : (
        <>
          <ManageBookingList rows={rows.map((r) => toManageBooking(r, history))} showFacility={facilities.length > 1} />
          <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
        </>
      )}
    </div>
  );
}
