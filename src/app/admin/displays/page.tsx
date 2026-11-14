import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AlertTriangle, CalendarClock, PackageCheck, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { KpiTile } from "@/components/dashboard/kit";
import { Pagination } from "@/components/list/pagination";
import { BrandItemList } from "@/components/booking/brand-item-list";
import { toBrandItemView, BRAND_ITEMS_INCLUDE } from "@/lib/booking-view";
import { pageOf, sp, withParams, type SP } from "@/lib/list";
import { cn, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "방송 시연품 현황 | 스토리지마켓" };
const BASE = "/admin/displays";

// 최고관리자: 모든 예약의 방송 시연품 진행 현황 (브랜드 응답 · 발송 · 공간 도착) (2026-11-14)
const TABS = [
  { key: "active", label: "진행 중" },
  { key: "late", label: "기한 지남" },
  { key: "waiting", label: "예약 승인 전" },
  { key: "arrived", label: "도착 완료" },
  { key: "closed", label: "준비 불가 · 취소" },
] as const;

export default async function AdminDisplays({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const now = new Date();
  const tab = (TABS.find((t) => t.key === sp(searchParams, "tab"))?.key ?? "active") as (typeof TABS)[number]["key"];
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const open = { kind: "DISPLAY" as const, status: { in: ["PENDING", "APPROVED", "SHIPPED"] as ("PENDING" | "APPROVED" | "SHIPPED")[] } };
  const where: Prisma.BookingBrandItemWhereInput =
    tab === "late" ? { brandRequest: { kind: "DISPLAY", status: { in: ["PENDING", "APPROVED"] } }, dueAt: { lt: now }, booking: { status: "APPROVED" } }
    : tab === "waiting" ? { brandRequestId: null, booking: { status: "PENDING" } }
    : tab === "arrived" ? { brandRequest: { kind: "DISPLAY", status: "COMPLETED" } }
    : tab === "closed" ? { brandRequest: { kind: "DISPLAY", status: { in: ["REJECTED", "CANCELLED", "REFUNDED"] } } }
    : { brandRequest: open, booking: { status: "APPROVED" } };
  const [rows, total, cActive, cLate, cWaiting, cArrived] = await Promise.all([
    prisma.bookingBrandItem.findMany({
      where, orderBy: tab === "arrived" || tab === "closed" ? { createdAt: "desc" } : { dueAt: "asc" }, skip, take,
      include: {
        ...BRAND_ITEMS_INCLUDE.include,
        booking: { select: { id: true, code: true, startAt: true, status: true, facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true, companyName: true } } } } } },
      },
    }),
    prisma.bookingBrandItem.count({ where }),
    prisma.bookingBrandItem.count({ where: { brandRequest: open, booking: { status: "APPROVED" } } }),
    prisma.bookingBrandItem.count({ where: { brandRequest: { kind: "DISPLAY", status: { in: ["PENDING", "APPROVED"] } }, dueAt: { lt: now }, booking: { status: "APPROVED" } } }),
    prisma.bookingBrandItem.count({ where: { brandRequestId: null, booking: { status: "PENDING" } } }),
    prisma.bookingBrandItem.count({ where: { brandRequest: { kind: "DISPLAY", status: "COMPLETED" } } }),
  ]);
  const count: Record<string, number> = { active: cActive, late: cLate, waiting: cWaiting, arrived: cArrived };
  return (
    <div className="space-y-5">
      <PageHeader title="방송 시연품 현황" description="셀러가 예약에 담은 브랜드 상품이 브랜드 확인 → 발송 → 공간 도착까지 어디쯤 왔는지 봅니다. 도착 기한은 방송 2일 전이에요." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="진행 중" value={String(cActive)} unit="건" icon={Truck} tone="violet" href={`${BASE}?tab=active`} />
        <KpiTile label="기한 지남 (미발송)" value={String(cLate)} unit="건" icon={AlertTriangle} tone={cLate ? "red" : "slate"} href={`${BASE}?tab=late`} />
        <KpiTile label="예약 승인 전" value={String(cWaiting)} unit="건" icon={CalendarClock} tone="amber" href={`${BASE}?tab=waiting`} />
        <KpiTile label="도착 완료" value={String(cArrived)} unit="건" icon={PackageCheck} tone="green" href={`${BASE}?tab=arrived`} />
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={withParams(BASE, {}, { tab: t.key === "active" ? undefined : t.key })}
            className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", tab === t.key ? "border-navy bg-navy text-white" : "border-[#E5E0D6] bg-white text-slate-600")}>
            {t.label}{count[t.key] ? ` ${count[t.key]}` : ""}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? <p className="rounded-2xl border bg-white px-4 py-10 text-center text-sm text-slate-500">해당하는 시연품이 없어요.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const seller = r.booking.seller.profile?.companyName || r.booking.seller.profile?.name || r.booking.seller.email;
            const late = !!r.dueAt && r.dueAt < now && ["PENDING", "APPROVED"].includes(r.brandRequest?.status ?? "");
            return (
              <li key={r.id} className={cn("rounded-2xl border bg-white p-4", late && "border-rose-200")}>
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <Link href={`/admin/bookings?q=${encodeURIComponent(r.booking.code ?? r.booking.id)}`} className="font-bold text-navy underline">{r.booking.code ?? "예약"}</Link>
                  <span>{r.booking.facility.name}</span>
                  <span>방송 {formatDateTime(r.booking.startAt)}</span>
                  <span>셀러 {seller}</span>
                  {late && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-600">도착 기한 지남</span>}
                </div>
                <BrandItemList items={[toBrandItemView(r)]} canConfirm={r.booking.status === "APPROVED"} />
              </li>
            );
          })}
        </ul>
      )}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
