import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { FilterBar } from "@/components/list/filter-bar";
import { StatusTabs } from "@/components/list/status-tabs";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime, formatKRW } from "@/lib/utils";
import { hhmm, hoursBetween } from "@/lib/kst";
import { dateRange, pageOf, sp, type SP } from "@/lib/list";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/manager/bookings";

// 중간관리자는 담당 창고(스튜디오) 예약을 조회만 한다. (승인은 창고(스튜디오) 관리자 권한)
export default async function ManagerBookings({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["MANAGER"]);
  const ids = await managerFacilityIds(user.id);
  const facilities = await prisma.facility.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const status = sp(searchParams, "status");
  const fid = sp(searchParams, "facility");
  const q = sp(searchParams, "q");
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const scope: Prisma.BookingWhereInput = { facilityId: fid && ids.includes(fid) ? fid : { in: ids } };
  const where: Prisma.BookingWhereInput = {
    ...scope, ...(status && { status: status as any }), ...(dateRange(searchParams) && { startAt: dateRange(searchParams) }),
    ...(q && { OR: [{ seller: { profile: { name: { contains: q, mode: "insensitive" } } } }, { seller: { email: { contains: q, mode: "insensitive" } } }, { purpose: { contains: q, mode: "insensitive" } }] }),
  };
  const [rows, total, grouped] = await Promise.all([
    prisma.booking.findMany({ where, skip, take, orderBy: { startAt: "desc" }, include: { facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true, companyName: true } } } } } }),
    prisma.booking.count({ where }),
    prisma.booking.groupBy({ by: ["status"], where: scope, _count: true }),
  ]);
  const c = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const all = grouped.reduce((s, g) => s + g._count, 0);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="예약 현황" description="담당 창고(스튜디오)의 예약 흐름을 확인합니다. 승인 지연이 있으면 운영자에게 안내해 주세요." />
      <StatusTabs base={BASE} params={searchParams} tabs={[{ value: "", label: "전체", count: all }, ...Object.entries(BOOKING_STATUS).map(([k, v]) => ({ value: k, label: v.label, count: c[k] ?? 0 }))]} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[
          { type: "search", key: "q", placeholder: "셀러 · 목적" },
          { type: "select", key: "facility", label: "창고(스튜디오)", options: facilities.map((f) => ({ value: f.id, label: f.name })) },
          { type: "date", key: "from", label: "이용일 시작" }, { type: "date", key: "to", label: "이용일 끝" },
        ]} />
        <CsvButton label="CSV" filename="담당예약" headers={["상태", "창고(스튜디오)", "셀러", "시작", "이용시간", "이용료"]}
          rows={rows.map((b) => [BOOKING_STATUS[b.status]?.label, b.facility.name, b.seller.profile?.name ?? b.seller.email, formatDateTime(b.startAt), hoursBetween(b.startAt, b.endAt), b.totalPrice])} />
      </div>
      {rows.length === 0 ? <EmptyState icon={<CalendarDays className="h-10 w-10" />} title="예약이 없습니다" /> : (
        <Card>
          <CardContent className="divide-y divide-[#F0ECE6] p-0">
            {rows.map((b) => {
              const waitH = b.status === "PENDING" ? Math.floor((Date.now() - b.createdAt.getTime()) / 3600000) : 0;
              return (
                <div key={b.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{b.facility.name} · {b.seller.profile?.name ?? b.seller.email}{b.seller.profile?.companyName ? ` (${b.seller.profile.companyName})` : ""}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(b.startAt)} ~ {hhmm(b.endAt)} · {hoursBetween(b.startAt, b.endAt)}시간{b.purpose ? ` · ${b.purpose}` : ""}</p>
                  </div>
                  {waitH >= 24 && <span className="text-xs font-semibold text-red-500">{waitH}시간째 대기</span>}
                  <span className="text-sm font-bold text-navy">{formatKRW(b.totalPrice)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
