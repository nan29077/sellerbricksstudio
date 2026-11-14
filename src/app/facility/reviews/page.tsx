import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { operableFacilityIds } from "@/lib/facility-owner";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi, ProgressRow } from "@/components/list/charts";
import { StatusTabs } from "@/components/list/status-tabs";
import { Pagination } from "@/components/list/pagination";
import { ReviewReply } from "@/components/booking/review-reply";
import { formatDate, formatDateTime } from "@/lib/utils";
import { pageOf, sp, type SP } from "@/lib/list";
import { Star, MessageSquareReply, ThumbsUp, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/facility/reviews";

export default async function FacilityReviews({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  const ids = await operableFacilityIds(user);
  const filter = sp(searchParams, "filter");
  const { page, size, skip, take } = pageOf(searchParams, 15);
  const scope: Prisma.FacilityReviewWhereInput = { facilityId: { in: ids } };
  const where: Prisma.FacilityReviewWhereInput = {
    ...scope,
    ...(filter === "unreplied" && { reply: null }),
    ...(filter === "low" && { rating: { lte: 3 } }),
    ...(filter === "high" && { rating: { gte: 4 } }),
  };
  const [rows, total, dist, unreplied, agg] = await Promise.all([
    prisma.facilityReview.findMany({ where, orderBy: { createdAt: "desc" }, skip, take,
      include: { facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } }, booking: { select: { startAt: true, purpose: true } } } }),
    prisma.facilityReview.count({ where }),
    prisma.facilityReview.groupBy({ by: ["rating"], where: scope, _count: true }),
    prisma.facilityReview.count({ where: { ...scope, reply: null } }),
    prisma.facilityReview.aggregate({ where: { ...scope, isHidden: false }, _avg: { rating: true }, _count: true }),
  ]);
  const count = (r: number) => dist.find((d) => d.rating === r)?._count ?? 0;
  const all = dist.reduce((s, d) => s + d._count, 0);
  const replied = all - unreplied;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="리뷰 관리" description="이용을 마친 셀러의 리뷰를 확인하고 답글로 소통하세요. 답글이 달린 창고(스튜디오)는 재예약률이 높아집니다." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="평균 평점" value={`★ ${(agg._avg.rating ?? 0).toFixed(1)}`} sub={`공개 리뷰 ${agg._count}개`} icon={Star} tone="brand" />
        <Kpi label="답글 대기" value={`${unreplied}개`} icon={MessageSquareReply} tone={unreplied ? "red" : "green"} />
        <Kpi label="답글률" value={all ? `${Math.round((replied / all) * 100)}%` : "-"} icon={ThumbsUp} tone="blue" />
        <Kpi label="3점 이하" value={`${count(1) + count(2) + count(3)}개`} sub="개선 포인트 확인" icon={AlertTriangle} tone="navy" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">평점 분포</CardTitle></CardHeader>
          <CardContent className="space-y-2">{[5, 4, 3, 2, 1].map((r) => <ProgressRow key={r} label={`${"★".repeat(r)}`} value={count(r)} max={Math.max(1, all)} right={`${count(r)}개`} tone={r <= 2 ? "red" : "brand"} />)}</CardContent>
        </Card>
        <div className="space-y-3">
          <StatusTabs base={BASE} params={searchParams} paramKey="filter" tabs={[
            { value: "", label: "전체", count: all }, { value: "unreplied", label: "답글 대기", count: unreplied },
            { value: "high", label: "4~5점", count: count(4) + count(5) }, { value: "low", label: "3점 이하", count: count(1) + count(2) + count(3) },
          ]} />
          {rows.length === 0 ? <EmptyState icon={<Star className="h-10 w-10" />} title="리뷰가 없습니다" description="셀러가 이용 완료 후 남긴 리뷰가 여기에 표시됩니다. 예약을 '이용 완료'로 처리해야 리뷰를 받을 수 있어요." /> : rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-brand-600">{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></span>
                  <span className="text-sm font-semibold text-navy">{r.seller.profile?.name ?? r.seller.email}</span>
                  {ids.length > 1 && <Badge tone="gray">{r.facility.name}</Badge>}
                  {r.isHidden && <Badge tone="red">운영팀 숨김</Badge>}
                  <span className="ml-auto text-[11px] text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">이용일 {formatDate(r.booking.startAt)}{r.booking.purpose ? ` · ${r.booking.purpose}` : ""}</p>
                <p className="whitespace-pre-line text-sm text-slate-700">{r.content}</p>
                {r.reply && <div className="rounded-xl bg-brand-50/60 px-3 py-2 text-sm text-slate-700"><b className="text-xs text-brand-700">내 답글 · {r.repliedAt ? formatDate(r.repliedAt) : ""}</b><p className="whitespace-pre-line">{r.reply}</p></div>}
                <ReviewReply id={r.id} initial={r.reply} />
              </CardContent>
            </Card>
          ))}
          <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
        </div>
      </div>
    </div>
  );
}
