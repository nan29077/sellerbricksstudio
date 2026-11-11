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
import { getPlatformFeeRate } from "@/lib/booking";
import { formatDate, formatKRW } from "@/lib/utils";
import { addMonths, kstStartOfMonth } from "@/lib/kst";
import { pageOf, sp, type SP } from "@/lib/list";
import { Building2, Clock, Ban, Star, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/facilities";
const STATUS: Record<string, { label: string; tone: "yellow" | "green" | "red" }> = {
  PENDING: { label: "승인 대기", tone: "yellow" }, APPROVED: { label: "운영중", tone: "green" }, SUSPENDED: { label: "운영 정지", tone: "red" },
};

export default async function AdminFacilities({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const status = sp(searchParams, "status");
  const type = sp(searchParams, "type");
  const q = sp(searchParams, "q");
  const sort = sp(searchParams, "sort");
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const where: Prisma.FacilityWhereInput = {
    ...(status && { status: status as any }), ...(type && { type: type as any }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { region: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } },
      { owner: { email: { contains: q, mode: "insensitive" } } }, { owner: { profile: { name: { contains: q, mode: "insensitive" } } } }] }),
  };
  const mStart = kstStartOfMonth(new Date());
  const [rows, total, grouped, defaultRate, feeRules] = await Promise.all([
    prisma.facility.findMany({
      where, skip, take,
      orderBy: sort === "rating" ? { rating: "desc" } : sort === "price" ? { basePrice: "desc" } : [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        owner: { select: { email: true, profile: { select: { name: true, phone: true } } } },
        managers: { include: { manager: { select: { profile: { select: { name: true } }, email: true } } } },
        _count: { select: { bookings: true, reviews: true, favorites: true } },
      },
    }),
    prisma.facility.count({ where }),
    prisma.facility.groupBy({ by: ["status"], _count: true }),
    getPlatformFeeRate(),
    prisma.commissionRule.findMany({ where: { scope: "FACILITY" } }),
  ]);
  const ids = rows.map((r) => r.id);
  const [monthRev, pending] = await Promise.all([
    prisma.booking.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, status: { in: ["APPROVED", "COMPLETED"] }, startAt: { gte: mStart, lt: addMonths(mStart, 1) } }, _sum: { totalPrice: true }, _count: true }),
    prisma.booking.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, status: "PENDING" }, _count: true }),
  ]);
  const rev = new Map(monthRev.map((r) => [r.facilityId, r]));
  const pend = new Map(pending.map((r) => [r.facilityId, r._count]));
  const fee = new Map(feeRules.map((r) => [r.facilityId, r.commissionValue]));
  const c = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const all = grouped.reduce((s, g) => s + g._count, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="창고(스튜디오) 관리" description="신규 등록 승인, 운영 정지, 창고(스튜디오)별 수수료율과 운영 지표를 관리합니다." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="전체" value={`${all}곳`} icon={Building2} tone="navy" />
        <Kpi label="승인 대기" value={`${c.PENDING ?? 0}곳`} icon={Clock} tone={(c.PENDING ?? 0) > 0 ? "red" : "brand"} />
        <Kpi label="운영 정지" value={`${c.SUSPENDED ?? 0}곳`} icon={Ban} tone="navy" />
        <Kpi label="기본 수수료율" value={`${defaultRate}%`} sub={`개별 설정 ${feeRules.length}곳`} icon={Star} tone="brand" />
      </div>
      <StatusTabs base={BASE} params={searchParams} tabs={[{ value: "", label: "전체", count: all }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label, count: c[k] ?? 0 }))]} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[
          { type: "search", key: "q", placeholder: "이름 · 지역 · 주소 · 운영자" },
          { type: "select", key: "type", label: "유형", options: [{ value: "STUDIO", label: "스튜디오" }, { value: "WAREHOUSE", label: "창고" }] },
          { type: "select", key: "sort", label: "정렬", options: [{ value: "rating", label: "평점 높은 순" }, { value: "price", label: "요금 높은 순" }] },
        ]} />
        <CsvButton label="CSV" filename="창고목록" headers={["이름", "유형", "상태", "지역", "운영자", "이메일", "시간당요금", "평점", "리뷰", "누적예약", "이번달매출", "수수료율"]}
          rows={rows.map((f) => [f.name, f.type === "STUDIO" ? "스튜디오" : "창고", STATUS[f.status]?.label, f.region, f.owner.profile?.name, f.owner.email, f.basePrice, f.rating, f._count.reviews, f._count.bookings, rev.get(f.id)?._sum.totalPrice ?? 0, fee.get(f.id) ?? defaultRate])} />
      </div>
      {rows.length === 0 ? <EmptyState icon={<Building2 className="h-10 w-10" />} title="조건에 맞는 창고(스튜디오)가 없습니다" /> : (
        <div className="space-y-3">
          {rows.map((f) => {
            const st = STATUS[f.status];
            const r = rev.get(f.id);
            const missing = [!f.bankAccount && "정산 계좌", !f.cancelPolicy && "취소 규정", !f.thumbnailUrl && "대표 이미지"].filter(Boolean);
            return (
              <Card key={f.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <Badge tone={f.type === "STUDIO" ? "purple" : "blue"}>{f.type === "STUDIO" ? "스튜디오" : "창고"}</Badge>
                        {fee.has(f.id) && <Badge tone="default">수수료 {fee.get(f.id)}%</Badge>}
                        <span className="text-[11px] text-muted-foreground">등록 {formatDate(f.createdAt)}</span>
                      </div>
                      <Link href={`/facilities/${f.id}`} target="_blank" className="flex items-center gap-1 text-lg font-bold text-navy hover:underline">{f.name}<ExternalLink className="h-3.5 w-3.5 text-slate-400" /></Link>
                      <p className="text-xs text-slate-500">{f.region} · {f.address}</p>
                      <p className="text-xs text-slate-500">운영자 {f.owner.profile?.name ?? "-"} ({f.owner.email}{f.owner.profile?.phone ? ` · ${f.owner.profile.phone}` : ""})
                        {f.managers.length > 0 && ` · 담당 매니저 ${f.managers.map((m) => m.manager.profile?.name ?? m.manager.email).join(", ")}`}</p>
                      {missing.length > 0 && <p className="text-[11px] font-semibold text-amber-600">미입력: {missing.join(", ")}</p>}
                    </div>
                    <div className="grid shrink-0 grid-cols-4 gap-2 text-center lg:w-[360px]">
                      {[["요금/h", formatKRW(f.basePrice)], ["평점", `★${f.rating.toFixed(1)} (${f._count.reviews})`], ["이번 달", `${r?._count ?? 0}건`], ["매출", formatKRW(r?._sum.totalPrice ?? 0)]].map(([l, v]) => (
                        <div key={l} className="rounded-xl bg-muted/50 p-2"><p className="text-[10px] text-slate-500">{l}</p><p className="truncate text-xs font-bold text-navy">{v}</p></div>
                      ))}
                      <p className="col-span-4 text-[11px] text-slate-500">누적 예약 {f._count.bookings}건 · 대기 {pend.get(f.id) ?? 0}건 · 찜 {f._count.favorites}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#F0ECE6] pt-3">
                    {f.status !== "APPROVED" && <PatchButton url={`/api/admin/facilities/${f.id}`} body={{ status: "APPROVED" }} variant="success" confirmText={`'${f.name}'을(를) ${f.status === "SUSPENDED" ? "운영 재개" : "승인"}할까요?`}>{f.status === "SUSPENDED" ? "운영 재개" : "승인"}</PatchButton>}
                    {f.status !== "SUSPENDED" && <ResourceForm url={`/api/admin/facilities/${f.id}`} method="PATCH" extraBody={{ status: "SUSPENDED" }} title="운영 정지" triggerSize="sm" triggerVariant="outline"
                      fields={[{ name: "reason", label: "정지 사유 (운영자에게 전달)", type: "textarea", required: true }]} />}
                    <ResourceForm url={`/api/admin/facilities/${f.id}`} method="PATCH" title="수수료율 설정" triggerSize="sm" triggerVariant="ghost"
                      initial={{ feeRate: fee.get(f.id) ?? "" }} fields={[{ name: "feeRate", label: "플랫폼 수수료율(%)", type: "number", min: 0, max: 100, help: `비우고 저장하면 기본값 ${defaultRate}%를 사용합니다.` }]} />
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
