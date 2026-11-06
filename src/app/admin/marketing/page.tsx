import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi, ProgressRow } from "@/components/list/charts";
import { StatusTabs } from "@/components/list/status-tabs";
import { FilterBar } from "@/components/list/filter-bar";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { ResourceForm, PatchButton } from "@/components/resource-form";
import { APPLICATION_STATUS, APPLICATION_TYPES, discountLabel } from "@/lib/marketing-labels";
import { formatDate, formatDateTime, formatKRW } from "@/lib/utils";
import { pageOf, sp, type SP } from "@/lib/list";
import { Megaphone, Inbox, PlayCircle, Ticket } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/marketing";

export default async function AdminMarketing({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const status = sp(searchParams, "status");
  const type = sp(searchParams, "type");
  const q = sp(searchParams, "q");
  const { page, size, skip, take } = pageOf(searchParams, 15);
  const where: Prisma.MarketingApplicationWhereInput = {
    ...(status && { status }), ...(type && { type }),
    ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { seller: { email: { contains: q, mode: "insensitive" } } }, { seller: { profile: { name: { contains: q, mode: "insensitive" } } } }] }),
  };
  const now = new Date();
  const [rows, total, grouped, activePromos, activeCoupons, budgets, topSellers] = await Promise.all([
    prisma.marketingApplication.findMany({ where, skip, take, orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { seller: { select: { email: true, profile: { select: { name: true, phone: true } }, _count: { select: { bookings: true } } } } } }),
    prisma.marketingApplication.count({ where }),
    prisma.marketingApplication.groupBy({ by: ["status"], _count: true }),
    prisma.sellerPromotion.findMany({ where: { isPublished: true, startAt: { lte: now }, endAt: { gte: now } }, orderBy: { endAt: "asc" }, take: 8, include: { seller: { select: { email: true, profile: { select: { name: true } } } } } }),
    prisma.sellerCoupon.count({ where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } } }),
    prisma.marketingApplication.aggregate({ where: { status: { in: ["APPROVED", "DONE"] } }, _sum: { budget: true } }),
    prisma.snsAccount.groupBy({ by: ["sellerId"], _sum: { followers: true }, orderBy: { _sum: { followers: "desc" } }, take: 6 }),
  ]);
  const sellerNames = await prisma.user.findMany({ where: { id: { in: topSellers.map((t) => t.sellerId) } }, select: { id: true, email: true, profile: { select: { name: true } } } });
  const nameOf = (id: string) => { const u = sellerNames.find((x) => x.id === id); return u?.profile?.name ?? u?.email ?? "셀러"; };
  const c = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const all = grouped.reduce((s, g) => s + g._count, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="마케팅 지원" description="셀러의 마케팅 지원 신청을 검토하고, 진행 중인 셀러 프로모션 현황을 확인합니다." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="새 신청" value={`${c.PENDING ?? 0}건`} sub={`검토중 ${c.IN_REVIEW ?? 0}건`} icon={Inbox} tone={(c.PENDING ?? 0) ? "red" : "brand"} />
        <Kpi label="승인 · 진행" value={`${(c.APPROVED ?? 0) + (c.DONE ?? 0)}건`} sub={`승인 예산 ${formatKRW(budgets._sum.budget ?? 0)}`} icon={Megaphone} tone="green" />
        <Kpi label="진행 중 셀러 이벤트" value={`${activePromos.length}건`} icon={PlayCircle} tone="blue" />
        <Kpi label="사용 가능 쿠폰" value={`${activeCoupons}개`} icon={Ticket} tone="navy" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <StatusTabs base={BASE} params={searchParams} tabs={[{ value: "", label: "전체", count: all }, ...Object.entries(APPLICATION_STATUS).map(([k, v]) => ({ value: k, label: v.label, count: c[k] ?? 0 }))]} />
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
            <FilterBar className="flex-1" fields={[
              { type: "search", key: "q", placeholder: "제목 · 셀러" },
              { type: "select", key: "type", label: "유형", options: Object.entries(APPLICATION_TYPES).map(([value, label]) => ({ value, label })) },
            ]} />
            <CsvButton label="CSV" filename="마케팅지원신청" headers={["상태", "유형", "제목", "셀러", "이메일", "예산", "희망일", "신청일"]}
              rows={rows.map((a) => [APPLICATION_STATUS[a.status]?.label, APPLICATION_TYPES[a.type], a.title, a.seller.profile?.name, a.seller.email, a.budget, a.desiredAt ? formatDate(a.desiredAt) : "", formatDate(a.createdAt)])} />
          </div>
          {rows.length === 0 ? <EmptyState icon={<Megaphone className="h-10 w-10" />} title="신청이 없습니다" /> : rows.map((a) => {
            const st = APPLICATION_STATUS[a.status] ?? { label: a.status, tone: "gray" as const };
            return (
              <Card key={a.id}>
                <CardContent className="space-y-2 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={st.tone}>{st.label}</Badge><Badge tone="gray">{APPLICATION_TYPES[a.type] ?? a.type}</Badge>
                    <span className="text-base font-bold text-navy">{a.title}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500">{a.seller.profile?.name ?? a.seller.email} · {a.seller.email}{a.seller.profile?.phone ? ` · ${a.seller.profile.phone}` : ""} · 예약 {a.seller._count.bookings}건
                    {a.budget ? ` · 예산 ${formatKRW(a.budget)}` : ""}{a.desiredAt ? ` · 희망일 ${formatDate(a.desiredAt)}` : ""}</p>
                  <p className="whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm text-slate-700">{a.content}</p>
                  {a.adminNote && <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800"><b>답변</b> · {a.adminNote}</p>}
                  <div className="flex flex-wrap gap-2">
                    {a.status === "PENDING" && <PatchButton url={`/api/admin/marketing/applications/${a.id}`} body={{ status: "IN_REVIEW" }} variant="outline">검토 시작</PatchButton>}
                    {["PENDING", "IN_REVIEW"].includes(a.status) && <ResourceForm url={`/api/admin/marketing/applications/${a.id}`} method="PATCH" extraBody={{ status: "APPROVED" }} title="승인" triggerSize="sm" triggerVariant="success"
                      initial={{ adminNote: a.adminNote ?? "" }} fields={[{ name: "adminNote", label: "셀러에게 보낼 안내 (진행 일정, 담당자 등)", type: "textarea" }]} />}
                    {["PENDING", "IN_REVIEW"].includes(a.status) && <ResourceForm url={`/api/admin/marketing/applications/${a.id}`} method="PATCH" extraBody={{ status: "REJECTED" }} title="반려" triggerSize="sm" triggerVariant="outline"
                      fields={[{ name: "adminNote", label: "반려 사유", type: "textarea", required: true }]} />}
                    {a.status === "APPROVED" && <PatchButton url={`/api/admin/marketing/applications/${a.id}`} body={{ status: "DONE" }} confirmText="진행 완료로 처리할까요?">진행 완료</PatchButton>}
                    <ResourceForm url={`/api/admin/marketing/applications/${a.id}`} method="PATCH" title="답변 수정" triggerSize="sm" triggerVariant="ghost" initial={{ adminNote: a.adminNote ?? "" }} fields={[{ name: "adminNote", label: "답변", type: "textarea" }]} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">진행 중 셀러 이벤트</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {activePromos.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">없음</p> : activePromos.map((p) => (
                <div key={p.id} className="rounded-xl border border-border p-3">
                  <p className="truncate text-sm font-semibold text-navy">{p.title}</p>
                  <p className="text-[11px] text-muted-foreground">{p.seller.profile?.name ?? p.seller.email} · {discountLabel(p.discountType, p.discountValue)} · ~{formatDate(p.endAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">팔로워 상위 셀러</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {topSellers.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">등록된 SNS 채널이 없습니다.</p>
                : topSellers.map((t) => <ProgressRow key={t.sellerId} label={nameOf(t.sellerId)} value={t._sum.followers ?? 0} max={topSellers[0]._sum.followers ?? 1} tone="navy" />)}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
