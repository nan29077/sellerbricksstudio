import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { FilterBar } from "@/components/list/filter-bar";
import { StatusTabs } from "@/components/list/status-tabs";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { ManageBookingList } from "@/components/booking/manage-booking-list";
import { toManageBooking } from "@/lib/booking-view";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime, formatKRW } from "@/lib/utils";
import { addDays, addMonths, hoursBetween, kstStartOfMonth } from "@/lib/kst";
import { dateRange, growth, pageOf, pct, sp, type SP } from "@/lib/list";
import { CalendarDays, AlertCircle, Wallet, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/bookings";

export default async function AdminBookings({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const status = sp(searchParams, "status");
  const fid = sp(searchParams, "facility");
  const q = sp(searchParams, "q");
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const where: Prisma.BookingWhereInput = {
    ...(status && { status: status as any }), ...(fid && { facilityId: fid }),
    ...(dateRange(searchParams) && { startAt: dateRange(searchParams) }),
    ...(q && { OR: [
      { facility: { name: { contains: q, mode: "insensitive" } } }, { seller: { email: { contains: q, mode: "insensitive" } } },
      { seller: { profile: { name: { contains: q, mode: "insensitive" } } } }, { purpose: { contains: q, mode: "insensitive" } },
    ] }),
  };
  const mStart = kstStartOfMonth(new Date());
  const prev = addMonths(mStart, -1);
  const include = { facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true, phone: true, companyName: true } } } }, products: { orderBy: { createdAt: "asc" as const } } } as const;
  const [rows, total, grouped, facilities, thisM, lastM, stale, cancelM] = await Promise.all([
    prisma.booking.findMany({ where, include, skip, take, orderBy: status === "PENDING" ? { createdAt: "asc" } : { startAt: "desc" } }),
    prisma.booking.count({ where }),
    prisma.booking.groupBy({ by: ["status"], where: fid ? { facilityId: fid } : {}, _count: true }),
    prisma.facility.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.booking.aggregate({ where: { status: { in: ["APPROVED", "COMPLETED"] }, startAt: { gte: mStart, lt: addMonths(mStart, 1) } }, _sum: { totalPrice: true }, _count: true }),
    prisma.booking.aggregate({ where: { status: { in: ["APPROVED", "COMPLETED"] }, startAt: { gte: prev, lt: mStart } }, _sum: { totalPrice: true }, _count: true }),
    prisma.booking.count({ where: { status: "PENDING", createdAt: { lt: addDays(new Date(), -1) } } }),
    prisma.booking.groupBy({ by: ["status"], where: { createdAt: { gte: mStart } }, _count: true }),
  ]);
  const c = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const all = grouped.reduce((s, g) => s + g._count, 0);
  const cm = Object.fromEntries(cancelM.map((g) => [g.status, g._count]));
  const createdM = cancelM.reduce((s, g) => s + g._count, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="예약 현황" description="전체 창고(스튜디오)의 예약을 조회하고, 필요하면 운영자를 대신해 처리합니다." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="이번 달 확정 예약" value={`${thisM._count}건`} delta={growth(thisM._count, lastM._count)} sub="지난달 대비 · 이용료 무료" icon={Wallet} tone="green" />
        <Kpi label="승인 대기" value={`${c.PENDING ?? 0}건`} sub={stale ? `24시간 넘게 대기 ${stale}건` : "지연 없음"} icon={AlertCircle} tone={stale ? "red" : "brand"} />
        <Kpi label="이번 달 신청" value={`${createdM}건`} sub={`승인률 ${pct((cm.APPROVED ?? 0) + (cm.COMPLETED ?? 0), createdM)}%`} icon={CalendarDays} tone="blue" />
        <Kpi label="이번 달 취소·거절" value={`${(cm.CANCELLED ?? 0) + (cm.REJECTED ?? 0)}건`} sub={`${pct((cm.CANCELLED ?? 0) + (cm.REJECTED ?? 0), createdM)}%`} icon={XCircle} tone="navy" />
      </div>
      <StatusTabs base={BASE} params={searchParams} tabs={[{ value: "", label: "전체", count: all }, ...Object.entries(BOOKING_STATUS).map(([k, v]) => ({ value: k, label: v.label, count: c[k] ?? 0 }))]} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[
          { type: "search", key: "q", placeholder: "창고(스튜디오) · 셀러 · 목적" },
          { type: "select", key: "facility", label: "창고(스튜디오)", options: facilities.map((f) => ({ value: f.id, label: f.name })) },
          { type: "date", key: "from", label: "이용일 시작" }, { type: "date", key: "to", label: "이용일 끝" },
        ]} />
        <CsvButton label="CSV" filename="전체예약" headers={["상태", "창고(스튜디오)", "셀러", "이메일", "시작", "이용시간", "예약번호", "신청일"]}
          rows={rows.map((b) => [BOOKING_STATUS[b.status]?.label, b.facility.name, b.seller.profile?.name, b.seller.email, formatDateTime(b.startAt), hoursBetween(b.startAt, b.endAt), b.code, formatDateTime(b.createdAt)])} />
      </div>
      {rows.length === 0 ? <EmptyState icon={<CalendarDays className="h-10 w-10" />} title="조건에 맞는 예약이 없습니다" /> : (
        <>
          <ManageBookingList rows={rows.map((r) => toManageBooking(r))} />
          <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
        </>
      )}
    </div>
  );
}
