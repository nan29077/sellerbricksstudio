import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { StatusTabs } from "@/components/list/status-tabs";
import { FilterBar } from "@/components/list/filter-bar";
import { Pagination } from "@/components/list/pagination";
import { PatchButton, DeleteButton } from "@/components/resource-form";
import { formatDate, formatDateTime } from "@/lib/utils";
import { pageOf, sp, type SP } from "@/lib/list";
import { Star, EyeOff, MessageSquareReply, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/reviews";

export default async function AdminReviews({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const filter = sp(searchParams, "filter");
  const q = sp(searchParams, "q");
  const fid = sp(searchParams, "facility");
  const { page, size, skip, take } = pageOf(searchParams, 20);
  const where: Prisma.FacilityReviewWhereInput = {
    ...(fid && { facilityId: fid }),
    ...(filter === "hidden" && { isHidden: true }), ...(filter === "low" && { rating: { lte: 2 } }), ...(filter === "unreplied" && { reply: null }),
    ...(q && { OR: [{ content: { contains: q, mode: "insensitive" } }, { facility: { name: { contains: q, mode: "insensitive" } } }, { seller: { email: { contains: q, mode: "insensitive" } } }] }),
  };
  const [rows, total, all, hidden, low, unreplied, avg, facilities] = await Promise.all([
    prisma.facilityReview.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } }, booking: { select: { startAt: true } } } }),
    prisma.facilityReview.count({ where }),
    prisma.facilityReview.count(),
    prisma.facilityReview.count({ where: { isHidden: true } }),
    prisma.facilityReview.count({ where: { rating: { lte: 2 } } }),
    prisma.facilityReview.count({ where: { reply: null } }),
    prisma.facilityReview.aggregate({ where: { isHidden: false }, _avg: { rating: true } }),
    prisma.facility.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="리뷰 관리" description="전체 창고(스튜디오) 리뷰를 모니터링하고, 부적절한 리뷰는 숨김 처리합니다. 숨긴 리뷰는 평점 계산에서 제외됩니다." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="전체 평균" value={`★ ${(avg._avg.rating ?? 0).toFixed(2)}`} sub={`리뷰 ${all}개`} icon={Star} tone="brand" />
        <Kpi label="2점 이하" value={`${low}개`} icon={AlertTriangle} tone="red" />
        <Kpi label="답글 없음" value={`${unreplied}개`} icon={MessageSquareReply} tone="blue" />
        <Kpi label="숨김" value={`${hidden}개`} icon={EyeOff} tone="navy" />
      </div>
      <StatusTabs base={BASE} params={searchParams} paramKey="filter" tabs={[
        { value: "", label: "전체", count: all }, { value: "low", label: "2점 이하", count: low }, { value: "unreplied", label: "답글 없음", count: unreplied }, { value: "hidden", label: "숨김", count: hidden },
      ]} />
      <FilterBar fields={[{ type: "search", key: "q", placeholder: "내용 · 창고(스튜디오) · 셀러 이메일" }, { type: "select", key: "facility", label: "창고(스튜디오)", options: facilities.map((f) => ({ value: f.id, label: f.name })) }]} />
      {rows.length === 0 ? <EmptyState icon={<Star className="h-10 w-10" />} title="리뷰가 없습니다" /> : rows.map((r) => (
        <Card key={r.id} className={r.isHidden ? "opacity-70" : ""}>
          <CardContent className="space-y-2 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-brand-600">{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></span>
              <Badge tone="gray">{r.facility.name}</Badge>
              {r.isHidden && <Badge tone="red">숨김</Badge>}
              <span className="text-xs text-slate-500">{r.seller.profile?.name ?? r.seller.email} · 이용 {formatDate(r.booking.startAt)}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{formatDateTime(r.createdAt)}</span>
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700">{r.content}</p>
            {r.reply && <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-slate-600">↳ 운영자 답글: {r.reply}</p>}
            <div className="flex gap-2">
              <PatchButton url={`/api/reviews/${r.id}`} body={{ isHidden: !r.isHidden }} variant="outline" confirmText={r.isHidden ? "다시 공개할까요?" : "이 리뷰를 숨길까요? 평점 계산에서 제외됩니다."}>{r.isHidden ? "공개로 전환" : "숨김"}</PatchButton>
              <DeleteButton url={`/api/reviews/${r.id}`} label="삭제" confirmText="리뷰를 완전히 삭제할까요? 셀러는 다시 작성할 수 있게 됩니다." />
            </div>
          </CardContent>
        </Card>
      ))}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
