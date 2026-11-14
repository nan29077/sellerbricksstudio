import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi, BarChart, ProgressRow } from "@/components/list/charts";
import { PLATFORMS, periodStatus } from "@/lib/marketing-labels";
import { formatKRW } from "@/lib/utils";
import { livePlatformLabel } from "@/lib/live-platforms";
import { addMonths, kstParts, kstStartOfMonth } from "@/lib/kst";
import { Eye, Heart, MousePointerClick, Users, Send, FileText, Target, CalendarCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SellerMarketingAnalytics() {
  const user = await requireRole(["SELLER"]);
  const start = addMonths(kstStartOfMonth(new Date()), -5);
  const [accounts, posts, promos, sheetByPlatform, bookings] = await Promise.all([
    prisma.snsAccount.findMany({ where: { sellerId: user.id } }),
    prisma.snsPost.findMany({ where: { sellerId: user.id, status: "POSTED", scheduledAt: { gte: start } } }),
    prisma.sellerPromotion.findMany({ where: { sellerId: user.id, isPublished: true } }),
    prisma.order.groupBy({ by: ["platform"], where: { sellerId: user.id, source: "SHEET", status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] }, createdAt: { gte: start } }, _count: { id: true }, _sum: { totalAmount: true } }),
    prisma.booking.findMany({ where: { sellerId: user.id, status: { in: ["APPROVED", "COMPLETED"] }, startAt: { gte: start } }, select: { startAt: true, totalPrice: true } }),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => addMonths(start, i));
  const label = (d: Date) => `${kstParts(d).month}월`;
  const inMonth = (d: Date, m: Date) => d >= m && d < addMonths(m, 1);

  const sum = (k: "views" | "likes" | "comments" | "clicks") => posts.reduce((s, p) => s + (p[k] ?? 0), 0);
  const views = sum("views"), likes = sum("likes"), comments = sum("comments"), clicks = sum("clicks");
  const engagement = views ? Math.round(((likes + comments) / views) * 1000) / 10 : 0;
  const ctr = views ? Math.round((clicks / views) * 1000) / 10 : 0;
  const followers = accounts.reduce((s, a) => s + a.followers, 0);

  const byPlatform = Object.keys(PLATFORMS).map((k) => {
    const ps = posts.filter((p) => p.platform === k);
    const v = ps.reduce((s, p) => s + (p.views ?? 0), 0);
    const e = ps.reduce((s, p) => s + (p.likes ?? 0) + (p.comments ?? 0), 0);
    return { k, label: PLATFORMS[k].label, count: ps.length, views: v, rate: v ? Math.round((e / v) * 1000) / 10 : 0 };
  }).filter((r) => r.count > 0).sort((a, b) => b.views - a.views);
  const topPosts = [...posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  const ended = promos.filter((p) => periodStatus(p.startAt, p.endAt).key === "ENDED" && p.targetAmount);
  const sheetTotal = sheetByPlatform.reduce((s, g) => s + g._count.id, 0);
  const sheetRows = [...sheetByPlatform].sort((a, b) => b._count.id - a._count.id);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="마케팅 분석" description="최근 6개월 동안 등록한 SNS 성과·이벤트·판매 플랫폼별 주문서·방송 예약 데이터를 모아 보여줍니다." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="총 팔로워" value={followers.toLocaleString()} sub={`${accounts.length}개 채널`} icon={Users} tone="brand" />
        <Kpi label="콘텐츠 조회수" value={views.toLocaleString()} sub={`게시 ${posts.length}건`} icon={Eye} tone="blue" />
        <Kpi label="참여율" value={`${engagement}%`} sub="(좋아요+댓글)/조회" icon={Heart} tone="red" />
        <Kpi label="링크 클릭률" value={`${ctr}%`} sub={`클릭 ${clicks.toLocaleString()}회`} icon={MousePointerClick} tone="green" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4 text-brand-500" />월별 게시 수</CardTitle></CardHeader>
          <CardContent><BarChart data={months.map((m) => ({ label: label(m), value: posts.filter((p) => inMonth(p.scheduledAt, m)).length }))} format={(n) => `${n}건`} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4 text-brand-500" />월별 조회수</CardTitle></CardHeader>
          <CardContent><BarChart data={months.map((m) => ({ label: label(m), value: posts.filter((p) => inMonth(p.scheduledAt, m)).reduce((s, p) => s + (p.views ?? 0), 0) }))} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">채널별 성과</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {byPlatform.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">SNS 마케팅 메뉴에서 게시 완료한 콘텐츠의 조회수·좋아요를 입력하면 채널별 성과가 표시됩니다.</p>
              : byPlatform.map((r) => <ProgressRow key={r.k} label={r.label} value={r.views} max={byPlatform[0].views} right={`${r.views.toLocaleString()} · 참여 ${r.rate}%`} />)}
            {accounts.length > 0 && (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-bold text-slate-500">채널별 팔로워</p>
                {accounts.sort((a, b) => b.followers - a.followers).map((a) => <ProgressRow key={a.id} label={`${PLATFORMS[a.platform]?.label} ${a.handle}`} value={a.followers} max={accounts[0].followers} tone="navy" />)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">조회수 상위 콘텐츠</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topPosts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">데이터가 없습니다.</p> : topPosts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy">{p.title}</p><p className="text-[11px] text-muted-foreground">{PLATFORMS[p.platform]?.label}</p></div>
                <div className="text-right text-xs"><p className="font-bold text-navy">👁 {(p.views ?? 0).toLocaleString()}</p><p className="text-muted-foreground">♥ {(p.likes ?? 0).toLocaleString()} · 클릭 {(p.clicks ?? 0).toLocaleString()}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-brand-500" />이벤트 목표 달성</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {ended.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">목표가 있는 종료 이벤트가 없습니다.</p> : ended.slice(0, 6).map((p) => {
              const rate = Math.round(((p.resultAmount ?? 0) / p.targetAmount!) * 100);
              return <ProgressRow key={p.id} label={p.title} value={Math.min(rate, 100)} max={100} right={`${rate}%`} tone={rate >= 100 ? "green" : "brand"} />;
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-brand-500" />판매 플랫폼별 주문서</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-extrabold text-navy">{sheetTotal.toLocaleString()}<span className="ml-1 text-sm font-medium text-muted-foreground">건</span></p>
            {sheetRows.slice(0, 6).map((g) => <ProgressRow key={g.platform ?? "none"} label={livePlatformLabel(g.platform)} value={g._count.id} max={Math.max(1, sheetRows[0]?._count.id ?? 1)} right={formatKRW(g._sum.totalAmount ?? 0)} tone="navy" />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="h-4 w-4 text-brand-500" />월별 방송 예약 · 이용료</CardTitle></CardHeader>
          <CardContent>
            <BarChart height={110} data={months.map((m) => ({ label: label(m), value: bookings.filter((b) => inMonth(b.startAt, m)).reduce((s, b) => s + b.totalPrice, 0) }))} format={(n) => formatKRW(n)} />
            <p className="mt-2 text-xs text-muted-foreground">6개월 확정 예약 {bookings.length}건 · {formatKRW(bookings.reduce((s, b) => s + b.totalPrice, 0))}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
