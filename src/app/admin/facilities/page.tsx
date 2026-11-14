import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { FilterBar } from "@/components/list/filter-bar";
import { StatusTabs } from "@/components/list/status-tabs";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { ResourceForm, PatchButton } from "@/components/resource-form";
import { formatDate, formatKRW } from "@/lib/utils";
import { addMonths, kstStartOfMonth } from "@/lib/kst";
import { pageOf, sp, type SP } from "@/lib/list";
import { Building2, Clock, Ban, Handshake, ExternalLink } from "lucide-react";
import { facilityTypeLabel, facilityTypeTone, FACILITY_OPERATION_LABEL, FACILITY_STATUS_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";
const BASE = "/admin/facilities";
const STATUS: Record<string, { label: string; tone: "yellow" | "green" | "red" }> = {
  APPROVED: { label: FACILITY_STATUS_LABEL.APPROVED, tone: "green" }, PENDING: { label: FACILITY_STATUS_LABEL.PENDING, tone: "yellow" }, SUSPENDED: { label: FACILITY_STATUS_LABEL.SUSPENDED, tone: "red" },
};
const SOLD = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

export default async function AdminFacilities({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const status = sp(searchParams, "status");
  const type = sp(searchParams, "type");
  const q = sp(searchParams, "q");
  const sort = sp(searchParams, "sort");
  const op = sp(searchParams, "op");
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const where: Prisma.FacilityWhereInput = {
    ...(status && { status: status as any }), ...(type && { type: type as any }), ...((op === "DIRECT" || op === "PARTNER") && { operationType: op }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { region: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } },
      { partnerName: { contains: q, mode: "insensitive" } }, { partnerContactName: { contains: q, mode: "insensitive" } }] }),
  };
  const mStart = kstStartOfMonth(new Date());
  const [rows, total, grouped, byOp] = await Promise.all([
    prisma.facility.findMany({
      where, skip, take,
      orderBy: sort === "rating" ? { rating: "desc" } : [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        managers: { include: { manager: { select: { profile: { select: { name: true } }, email: true } } } },
        _count: { select: { bookings: true, reviews: true, favorites: true } },
      },
    }),
    prisma.facility.count({ where }),
    prisma.facility.groupBy({ by: ["status"], _count: true }),
    prisma.facility.groupBy({ by: ["operationType"], _count: true }),
  ]);
  const ids = rows.map((r) => r.id);
  const [monthRev, pending] = await Promise.all([
    prisma.order.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, status: { in: [...SOLD] }, createdAt: { gte: mStart, lt: addMonths(mStart, 1) } }, _sum: { totalAmount: true }, _count: true }),
    prisma.booking.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, status: "PENDING" }, _count: true }),
  ]);
  const rev = new Map(monthRev.map((r) => [r.facilityId ?? "", r]));
  const pend = new Map(pending.map((r) => [r.facilityId, r._count]));
  const ops = Object.fromEntries(byOp.map((g) => [g.operationType, g._count]));
  const c = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const all = grouped.reduce((s, g) => s + g._count, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="공간 목록 · 공개" description="스토리지마켓이 직접 운영하는 창고 · 스튜디오 · 쇼룸과 제휴 창고입니다. 창고 계정은 없고, 운영은 창고 운영 콘솔에서 합니다."
        action={<div className="flex flex-wrap gap-2"><Link href="/facility/register" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-white">+ 공간 등록</Link><Link href="/facility/dashboard" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold text-navy">창고 운영 콘솔</Link></div>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="전체" value={`${all}곳`} sub={`공개 ${c.APPROVED ?? 0}곳`} icon={Building2} tone="navy" />
        <Kpi label="비공개(준비 중)" value={`${c.PENDING ?? 0}곳`} icon={Clock} tone="brand" />
        <Kpi label="운영 정지" value={`${c.SUSPENDED ?? 0}곳`} icon={Ban} tone="navy" />
        <Kpi label="직영 · 제휴" value={`${ops.DIRECT ?? 0} · ${ops.PARTNER ?? 0}곳`} icon={Handshake} tone="brand" />
      </div>
      <StatusTabs base={BASE} params={searchParams} tabs={[{ value: "", label: "전체", count: all }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label, count: c[k] ?? 0 }))]} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[
          { type: "search", key: "q", placeholder: "이름 · 지역 · 주소 · 제휴 업체" },
          { type: "select", key: "type", label: "유형", options: [{ value: "STUDIO", label: "스튜디오" }, { value: "WAREHOUSE", label: "창고" }, { value: "SHOWROOM", label: "쇼룸" }] },
          { type: "select", key: "op", label: "운영 형태", options: [{ value: "DIRECT", label: "직영" }, { value: "PARTNER", label: "제휴" }] },
          { type: "select", key: "sort", label: "정렬", options: [{ value: "rating", label: "평점 높은 순" }] },
        ]} />
        <CsvButton label="CSV" filename="창고목록" headers={["이름", "유형", "운영 형태", "상태", "지역", "제휴 업체", "제휴 담당자", "담당 매니저", "평점", "리뷰", "누적예약", "이번달 주문", "이번달 판매액"]}
          rows={rows.map((f) => [f.name, facilityTypeLabel(f.type), FACILITY_OPERATION_LABEL[f.operationType], STATUS[f.status]?.label, f.region, f.partnerName ?? "", [f.partnerContactName, f.partnerContactPhone].filter(Boolean).join(" "), f.managers.map((m) => m.manager.profile?.name ?? m.manager.email).join(", "), f.rating, f._count.reviews, f._count.bookings, rev.get(f.id)?._count ?? 0, rev.get(f.id)?._sum.totalAmount ?? 0])} />
      </div>
      {rows.length === 0 ? <EmptyState icon={<Building2 className="h-10 w-10" />} title="조건에 맞는 공간이 없습니다" /> : (
        <div className="space-y-3">
          {rows.map((f) => {
            const st = STATUS[f.status];
            const r = rev.get(f.id);
            const missing = [f.operationType === "PARTNER" && !f.bankAccount && "제휴 지급 계좌", !f.cancelPolicy && "취소 규정", !f.thumbnailUrl && "대표 이미지"].filter(Boolean);
            return (
              <Card key={f.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <Badge tone={facilityTypeTone(f.type)}>{facilityTypeLabel(f.type)}</Badge>
                        <Badge tone={f.operationType === "PARTNER" ? "purple" : "navy"}>{FACILITY_OPERATION_LABEL[f.operationType]}</Badge>
                        <span className="text-[11px] text-muted-foreground">등록 {formatDate(f.createdAt)}</span>
                      </div>
                      <Link href={`/facilities/${f.id}`} target="_blank" className="flex items-center gap-1 text-lg font-bold text-navy hover:underline">{f.name}<ExternalLink className="h-3.5 w-3.5 text-slate-400" /></Link>
                      <p className="text-xs text-slate-500">{f.region} · {f.address}</p>
                      {f.operationType === "PARTNER" && <p className="text-xs text-slate-500">제휴 {f.partnerName ?? "업체명 미입력"} · 담당 {f.partnerContactName ?? "-"}{f.partnerContactPhone ? ` · ${f.partnerContactPhone}` : ""}{f.partnerContactEmail ? ` · ${f.partnerContactEmail}` : ""}</p>}
                      <p className="text-xs text-slate-500">담당 매니저 {f.managers.length > 0 ? f.managers.map((m) => m.manager.profile?.name ?? m.manager.email).join(", ") : "없음 (최고관리자가 운영)"}</p>
                      {missing.length > 0 && <p className="text-[11px] font-semibold text-amber-600">미입력: {missing.join(", ")}</p>}
                    </div>
                    <div className="grid shrink-0 grid-cols-4 gap-2 text-center lg:w-[360px]">
                      {[["평점", `★${f.rating.toFixed(1)} (${f._count.reviews})`], ["대기 예약", `${pend.get(f.id) ?? 0}건`], ["이번 달 주문", `${r?._count ?? 0}건`], ["판매액", formatKRW(r?._sum.totalAmount ?? 0)]].map(([l, v]) => (
                        <div key={l} className="rounded-xl bg-muted/50 p-2"><p className="text-[11px] text-slate-500">{l}</p><p className="truncate text-xs font-bold text-navy">{v}</p></div>
                      ))}
                      <p className="col-span-4 text-[11px] text-slate-500">누적 예약 {f._count.bookings}건 · 찜 {f._count.favorites}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#F0ECE6] pt-3">
                    {f.status !== "APPROVED" && <PatchButton url={`/api/admin/facilities/${f.id}`} body={{ status: "APPROVED" }} variant="success" confirmText={`'${f.name}'을(를) ${f.status === "SUSPENDED" ? "운영 재개" : "공개"}할까요? 셀러가 예약할 수 있게 됩니다.`}>{f.status === "SUSPENDED" ? "운영 재개" : "공개하기"}</PatchButton>}
                    {f.status === "APPROVED" && <PatchButton url={`/api/admin/facilities/${f.id}`} body={{ status: "PENDING" }} variant="outline" confirmText={`'${f.name}'을(를) 비공개(준비 중)로 바꿀까요? 셀러 검색 · 새 예약에서 빠집니다. (기존 예약은 그대로)`}>비공개로</PatchButton>}
                    {f.status !== "SUSPENDED" && <ResourceForm url={`/api/admin/facilities/${f.id}`} method="PATCH" extraBody={{ status: "SUSPENDED" }} title="운영 정지" triggerSize="sm" triggerVariant="outline"
                      fields={[{ name: "reason", label: "정지 사유 (담당 매니저에게 전달)", type: "textarea", required: true }]} />}
                    <Link href="/facility/profile" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-navy hover:bg-brand-50">정보 · 운영 형태 편집</Link>
                    <Link href="/admin/managers" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-navy hover:bg-brand-50">담당 매니저 지정</Link>
                    <Link href={`/admin/bookings?facility=${f.id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-navy hover:bg-brand-50">예약 보기</Link>
                    <Link href={`/admin/facilities/${f.id}/shop`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-navy hover:bg-brand-50">샵 꾸미기</Link>
                    <Link href={`/admin/facility-products?facility=${f.id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-navy hover:bg-brand-50">샵 상품 관리</Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
