import Link from "next/link";
import { AdminBrandOverview } from "@/components/brand/admin-brand-overview";
import { prisma } from "@/lib/prisma";
import { reportDbError, type DbIssue } from "@/lib/db-error";
import { requireRole } from "@/lib/auth";
import { addDays, addMonths, kstParts, kstStartOfDay, kstStartOfMonth } from "@/lib/kst";
import { formatKRW } from "@/lib/utils";
import { PAYMENT_METHOD } from "@/lib/status";
import {
  SOLD_ORDER_STATUSES, compactKRW, dailySeries, deltaPct, greeting, ratio, relativeTime, todayLabel, zipSeries,
} from "@/lib/dashboard";
import {
  DashHero, DataNotice, Donut, Empty, Feed, HeroButton, HeroPanel, KpiTile, Meter, MiniStats, Panel,
  Pill, RankList, ShortcutGrid, StackBar, TodoList, TrendChart,
} from "@/components/dashboard/kit";
import {
  ArrowUpRight, BadgeAlert, Building2, CalendarDays, CircleDollarSign, ClipboardList, CreditCard, Globe,
  Headset, Megaphone, Radio, ScrollText, Settings2, ShoppingBag, Star, UserPlus, Users, Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ROLE_NAME: Record<string, string> = {
  SUPER_ADMIN: "최고관리자", MANAGER: "중간관리자", FACILITY_ADMIN: "창고(스튜디오) 관리자", BRAND_ADMIN: "브랜드사", SELLER: "셀러", BUYER: "구매자",
};

async function load() {
  const now = new Date();
  const today = kstStartOfDay(now);
  const monthStart = kstStartOfMonth(now);
  const lastMonthStart = addMonths(monthStart, -1);
  const lastMonthSameDay = new Date(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()));
  const d30 = addDays(today, -29);
  const from = d30 < lastMonthStart ? d30 : lastMonthStart;
  const sold = { in: [...SOLD_ORDER_STATUSES] };

  const [
    userCounts, facilityCounts, orders, bookings, users,
    pendingSettlements, pendingMarketing, lowReviews, supportWaiting, stalePending, failedPayments,
    liveNow, upcomingLives, latestBookings, latestOrders, recentUsers, regions, methods, reviewAgg,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.facility.groupBy({ by: ["status"], _count: true }),
    prisma.order.findMany({ where: { status: sold, createdAt: { gte: from } }, select: { createdAt: true, totalAmount: true, refundedAmount: true, sellerId: true } }),
    prisma.booking.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true, approvedAt: true, status: true, facilityId: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true } }),
    prisma.facilitySettlement.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.marketingApplication.count({ where: { status: "PENDING" } }),
    prisma.facilityReview.count({ where: { rating: { lte: 2 }, isHidden: false, createdAt: { gte: lastMonthStart } } }),
    prisma.supportInquiry.count({ where: { answeredAt: null } }),
    prisma.booking.count({ where: { status: "PENDING", createdAt: { lt: addDays(now, -1) } } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: addDays(now, -7) } } }),
    prisma.liveSession.findMany({
      where: { status: "LIVE" }, take: 4, orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, slug: true, seller: { select: { email: true, profile: { select: { name: true } } } }, facility: { select: { name: true } }, _count: { select: { orders: true } } },
    }),
    prisma.liveSession.findMany({
      where: { status: { in: ["READY", "DRAFT"] }, scheduledStart: { gte: now } }, take: 4, orderBy: { scheduledStart: "asc" },
      select: { id: true, title: true, scheduledStart: true, facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } },
    }),
    prisma.booking.findMany({
      take: 5, orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } },
    }),
    prisma.order.findMany({ take: 5, orderBy: { createdAt: "desc" }, select: { id: true, orderNo: true, buyerName: true, totalAmount: true, refundedAmount: true, status: true, createdAt: true } }),
    prisma.user.findMany({ take: 6, orderBy: { createdAt: "desc" }, select: { id: true, email: true, role: true, createdAt: true, lastLoginAt: true, profile: { select: { name: true } } } }),
    prisma.facility.groupBy({ by: ["region"], where: { status: "APPROVED" }, _count: true }),
    prisma.payment.groupBy({ by: ["method"], where: { status: "PAID", createdAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.facilityReview.aggregate({ where: { isHidden: false }, _avg: { rating: true }, _count: true }),
  ]);

  const inMonth = <T extends { createdAt: Date }>(rows: T[]) => rows.filter((r) => r.createdAt >= monthStart);
  const inLastSame = <T extends { createdAt: Date }>(rows: T[]) => rows.filter((r) => r.createdAt >= lastMonthStart && r.createdAt < lastMonthSameDay);
  const sum = (rows: { totalAmount: number; refundedAmount: number }[]) => rows.reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0);

  const mOrders = inMonth(orders), pOrders = inLastSame(orders);
  const mBookings = inMonth(bookings), pBookings = inLastSame(bookings);
  const mUsers = inMonth(users), pUsers = inLastSame(users);
  const gmv = sum(mOrders), gmvPrev = sum(pOrders);

  const ordersIn30 = orders.filter((o) => o.createdAt >= d30);
  const bookingsIn30 = bookings.filter((b) => b.createdAt >= d30);
  const gmvDaily = dailySeries(ordersIn30, 30, (o) => o.createdAt, (o) => (o.totalAmount - o.refundedAmount));
  const ordersDaily = dailySeries(ordersIn30, 30, (o) => o.createdAt);
  const bookingDaily = dailySeries(bookingsIn30, 30, (b) => b.createdAt);
  const userDaily = dailySeries(users.filter((u) => u.createdAt >= d30), 30, (u) => u.createdAt);

  // 이번 달 예약 상태 · 품질
  const st = (s: string) => mBookings.filter((b) => b.status === s).length;
  const approvedLike = st("APPROVED") + st("COMPLETED");
  const decided = approvedLike + st("REJECTED");
  const approvalHours = mBookings.filter((b) => b.approvedAt).map((b) => (b.approvedAt!.getTime() - b.createdAt.getTime()) / 3600000);
  const avgApproval = approvalHours.length ? approvalHours.reduce((a, b) => a + b, 0) / approvalHours.length : null;

  // TOP 창고(스튜디오) · 셀러
  const facCount = new Map<string, number>();
  for (const b of mBookings) if (b.status !== "CANCELLED") facCount.set(b.facilityId, (facCount.get(b.facilityId) ?? 0) + 1);
  const sellerGmv = new Map<string, { gmv: number; n: number }>();
  for (const o of mOrders) { const x = sellerGmv.get(o.sellerId) ?? { gmv: 0, n: 0 }; x.gmv += (o.totalAmount - o.refundedAmount); x.n += 1; sellerGmv.set(o.sellerId, x); }
  const topFacIds = [...facCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topSellerIds = [...sellerGmv.entries()].sort((a, b) => b[1].gmv - a[1].gmv).slice(0, 5);
  const [facNames, sellerNames] = await Promise.all([
    prisma.facility.findMany({ where: { id: { in: topFacIds.map(([id]) => id) } }, select: { id: true, name: true, region: true, rating: true } }),
    prisma.user.findMany({ where: { id: { in: topSellerIds.map(([id]) => id) } }, select: { id: true, email: true, profile: { select: { name: true, companyName: true } } } }),
  ]);

  const count = (rows: { _count: number; role?: string; status?: string }[], k: string) => rows.find((r) => r.role === k || r.status === k)?._count ?? 0;

  return {
    now, today,
    roles: userCounts, totalUsers: userCounts.reduce((s, r) => s + r._count, 0),
    facPending: count(facilityCounts, "PENDING"), facApproved: count(facilityCounts, "APPROVED"), facSuspended: count(facilityCounts, "SUSPENDED"),
    gmv, gmvDelta: deltaPct(gmv, gmvPrev),
    orders: mOrders.length, ordersDelta: deltaPct(mOrders.length, pOrders.length), aov: mOrders.length ? gmv / mOrders.length : 0,
    bookings: mBookings.length, bookingsDelta: deltaPct(mBookings.length, pBookings.length),
    newUsers: mUsers.length, usersDelta: deltaPct(mUsers.length, pUsers.length),
    todayOrders: orders.filter((o) => o.createdAt >= today), todayBookings: bookings.filter((b) => b.createdAt >= today).length,
    todayUsers: users.filter((u) => u.createdAt >= today).length,
    gmvDaily, ordersDaily, bookingDaily, userDaily,
    status: { PENDING: st("PENDING"), APPROVED: st("APPROVED"), COMPLETED: st("COMPLETED"), REJECTED: st("REJECTED"), CANCELLED: st("CANCELLED") },
    approvalRate: ratio(approvedLike, decided), cancelRate: ratio(st("CANCELLED"), mBookings.length), avgApproval,
    rating: reviewAgg._avg.rating, reviewCount: reviewAgg._count,
    pendingBookingsAll: await prisma.booking.count({ where: { status: "PENDING" } }),
    todo: { pendingSettlements, pendingMarketing, lowReviews, supportWaiting, stalePending, failedPayments },
    liveNow, upcomingLives, latestBookings, latestOrders, recentUsers,
    regions: regions.sort((a, b) => b._count - a._count),
    methods: methods.sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0)),
    topFacilities: topFacIds.map(([id, n]) => { const f = facNames.find((x) => x.id === id); return { key: id, name: f?.name ?? "창고(스튜디오)", sub: f ? `${f.region} · ★ ${f.rating.toFixed(1)}` : undefined, value: n, valueLabel: `${n}건` }; }),
    topSellers: topSellerIds.map(([id, v]) => { const u = sellerNames.find((x) => x.id === id); return { key: id, name: u?.profile?.name ?? u?.email ?? "셀러", sub: `${u?.profile?.companyName ? u.profile.companyName + " · " : ""}주문 ${v.n}건`, value: v.gmv, valueLabel: compactKRW(v.gmv) }; }),
  };
}

const nameOf = (u: { email: string; profile: { name: string | null } | null } | null | undefined) => u?.profile?.name || u?.email?.split("@")[0] || "회원";

export default async function AdminDashboard() {
  const me = await requireRole(["SUPER_ADMIN"]);
  let d: Awaited<ReturnType<typeof load>> | null = null;
  let issue: DbIssue = "unknown";
  try { d = await load(); } catch (e) { issue = reportDbError("admin-dashboard", e); }

  if (!d) {
    return (
      <div className="space-y-6 pb-6">
        <DashHero eyebrow={`OPERATIONS · ${todayLabel()}`} title={`${greeting()}, ${me.name ?? "관리자"}님`} description="운영 현황을 한눈에 보는 최고관리자 대시보드입니다." />
        <DataNotice issue={issue} />
      </div>
    );
  }

  const urgentCount = d.facPending + d.todo.stalePending + d.todo.supportWaiting + d.todo.failedPayments;
  const roleTone = { SELLER: "brand", FACILITY_ADMIN: "sky", BRAND_ADMIN: "green", MANAGER: "violet", SUPER_ADMIN: "navy", BUYER: "slate" } as const;
  const todayGmv = d.todayOrders.reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0);

  const feed = [
    ...d.latestBookings.map((b) => ({ key: "b" + b.id, at: b.createdAt, title: `${nameOf(b.seller)}님이 예약을 신청했어요`, sub: `${b.facility.name} · ${b.status === "PENDING" ? "승인 대기" : b.status === "APPROVED" ? "확정" : b.status === "COMPLETED" ? "이용 완료" : b.status === "REJECTED" ? "거절" : "취소"}`, icon: CalendarDays, tone: "violet" as const, href: `/admin/bookings?q=${encodeURIComponent(b.facility.name)}` })),
    ...d.latestOrders.map((o) => ({ key: "o" + o.id, at: o.createdAt, title: `새 주문 ${formatKRW(o.totalAmount)}`, sub: `${o.buyerName} · ${o.orderNo}`, icon: ShoppingBag, tone: "brand" as const, href: "/admin/orders" })),
    ...d.recentUsers.map((u) => ({ key: "u" + u.id, at: u.createdAt, title: `${nameOf(u)}님이 가입했어요`, sub: ROLE_NAME[u.role] ?? u.role, icon: UserPlus, tone: "green" as const, href: "/admin/users" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8).map((x) => ({ ...x, time: relativeTime(x.at) }));

  return (
    <div className="space-y-6 pb-6">
      <DashHero
        eyebrow={`OPERATIONS · ${todayLabel()}`}
        title={`${greeting()}, ${me.name ?? "관리자"}님`}
        description="거래, 예약, 회원, 정산 흐름을 한 화면에서 확인하고 필요한 작업으로 바로 이동하세요."
        chips={[
          ...(d.liveNow.length ? [{ label: `지금 방송 중 ${d.liveNow.length}건`, tone: "live" as const }] : []),
          ...(urgentCount ? [{ label: `확인 필요 ${urgentCount}건`, tone: "warn" as const }] : [{ label: "긴급 처리 항목 없음" }]),
          { label: `운영 창고(스튜디오) ${d.facApproved}곳` },
        ]}
        actions={<><HeroButton href="/admin/bookings?status=PENDING" primary><ClipboardList className="h-4 w-4" />예약 승인 처리</HeroButton><HeroButton href="/"><ArrowUpRight className="h-4 w-4" />사이트 보기</HeroButton></>}
        aside={
          <HeroPanel title="오늘의 운영">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                { k: "주문", v: `${d.todayOrders.length}건`, s: compactKRW(todayGmv) },
                { k: "예약 신청", v: `${d.todayBookings}건`, s: `대기 ${d.pendingBookingsAll}` },
                { k: "신규 가입", v: `${d.todayUsers}명`, s: `이번 달 ${d.newUsers}` },
              ].map((x) => (
                <div key={x.k} className="rounded-xl bg-white/[0.06] px-1 py-2.5">
                  <dt className="text-[11px] text-white/55">{x.k}</dt>
                  <dd className="mt-0.5 text-lg font-extrabold">{x.v}</dd>
                  <dd className="text-[11px] text-brand-200">{x.s}</dd>
                </div>
              ))}
            </dl>
          </HeroPanel>
        }
      />

      <AdminBrandOverview />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile emphasis label="이번 달 거래액" value={compactKRW(d.gmv)} delta={d.gmvDelta} sub="전월 동기 대비" icon={CircleDollarSign} tone="brand" spark={d.gmvDaily.map((x) => x.value)} href="/admin/orders" />
        <KpiTile label="결제 완료 주문" value={d.orders.toLocaleString("ko-KR")} unit="건" delta={d.ordersDelta} sub={`객단가 ${compactKRW(d.aov)}`} icon={ShoppingBag} tone="navy" spark={d.ordersDaily.map((x) => x.value)} href="/admin/orders" />
        <KpiTile label="예약 신청" value={d.bookings.toLocaleString("ko-KR")} unit="건" delta={d.bookingsDelta} sub="이번 달" icon={CalendarDays} tone="violet" spark={d.bookingDaily.map((x) => x.value)} href="/admin/bookings" />
        <KpiTile label="신규 가입" value={d.newUsers.toLocaleString("ko-KR")} unit="명" delta={d.usersDelta} sub={`전체 ${d.totalUsers.toLocaleString("ko-KR")}명`} icon={UserPlus} tone="green" spark={d.userDaily.map((x) => x.value)} href="/admin/users" />
        <KpiTile label="운영 창고(스튜디오)" value={String(d.facApproved)} unit="곳" sub={d.facPending ? `승인 대기 ${d.facPending}곳` : "승인 대기 없음"} icon={Building2} tone="sky" href="/admin/facilities" />
        <KpiTile label="라이브 방송" value={String(d.liveNow.length)} unit="건" sub={`예정 ${d.upcomingLives.length}건`} icon={Radio} tone="red" href="/admin/live-settings" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel eyebrow="LAST 30 DAYS" title="최근 30일 거래액 · 예약 추이" action={{ href: "/admin/orders", label: "주문 보기" }}>
          <TrendChart data={zipSeries(d.gmvDaily, d.bookingDaily)} a={{ name: "거래액", format: compactKRW }} b={{ name: "예약 신청", format: (n) => `${n}건` }} height={190} />
        </Panel>
        <Panel eyebrow="TO DO" title="처리가 필요한 작업">
          <TodoList items={[
            { label: "창고(스튜디오) 승인 대기", desc: "새로 등록된 공간을 검토하세요", n: d.facPending, href: "/admin/facilities?status=PENDING", icon: Building2, tone: "sky", urgent: d.facPending > 0 },
            { label: "24시간 넘게 대기 중인 예약", desc: "창고(스튜디오) 응답이 늦어지고 있어요", n: d.todo.stalePending, href: "/admin/bookings?status=PENDING", icon: BadgeAlert, tone: "red", urgent: true },
            { label: "답변 대기 고객 문의", desc: "고객센터 문의에 답변하세요", n: d.todo.supportWaiting, href: "/admin/support?status=waiting", icon: Headset, tone: "blue" },
            { label: "결제 실패 (최근 7일)", desc: "PG 오류·한도 초과 여부를 확인하세요", n: d.todo.failedPayments, href: "/admin/payments", icon: CreditCard, tone: "red" },
            { label: "정산 처리 대기", desc: "정산서를 확정하고 지급하세요", n: d.todo.pendingSettlements, href: "/admin/settlements", icon: Wallet, tone: "green" },
            { label: "마케팅 지원 신청", desc: "셀러의 지원 신청을 검토하세요", n: d.todo.pendingMarketing, href: "/admin/marketing?status=PENDING", icon: Megaphone, tone: "violet" },
            { label: "낮은 평점 리뷰", desc: "최근 2점 이하 리뷰를 점검하세요", n: d.todo.lowReviews, href: "/admin/reviews?filter=low", icon: Star, tone: "amber" },
          ]} emptyText="모든 운영 작업이 처리되었습니다" />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="BOOKING QUALITY" title="이번 달 예약 품질" action={{ href: "/admin/bookings", label: "예약 관리" }}>
          <StackBar segments={[
            { label: "승인 대기", value: d.status.PENDING, tone: "amber" },
            { label: "확정", value: d.status.APPROVED, tone: "green" },
            { label: "이용 완료", value: d.status.COMPLETED, tone: "blue" },
            { label: "거절", value: d.status.REJECTED, tone: "red" },
            { label: "취소", value: d.status.CANCELLED, tone: "slate" },
          ]} />
          <MiniStats className="mt-5" items={[
            { label: "승인율", value: `${d.approvalRate}%` },
            { label: "취소율", value: `${d.cancelRate}%` },
            { label: "평균 승인 소요", value: d.avgApproval === null ? "—" : d.avgApproval < 1 ? `${Math.max(1, Math.round(d.avgApproval * 60))}분` : `${Math.round(d.avgApproval * 10) / 10}시간` },
            { label: "평균 평점", value: d.rating ? `★ ${d.rating.toFixed(2)}` : "—", hint: `리뷰 ${d.reviewCount}개` },
          ]} />
        </Panel>
        <Panel eyebrow="MEMBER MIX" title="회원 구성" action={{ href: "/admin/users", label: "회원 관리" }}>
          <Donut
            centerValue={d.totalUsers.toLocaleString("ko-KR")} centerLabel="전체 회원"
            segments={(["SELLER", "FACILITY_ADMIN", "BRAND_ADMIN", "MANAGER", "BUYER", "SUPER_ADMIN"] as const)
              .map((r) => ({ label: ROLE_NAME[r], value: d!.roles.find((x) => x.role === r)?._count ?? 0, tone: roleTone[r] }))
              .filter((s) => s.value > 0)}
          />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel eyebrow="TOP SPACES" title="이번 달 인기 창고(스튜디오)" action={{ href: "/admin/facilities", label: "전체" }}>
          <RankList items={d.topFacilities} empty="이번 달 예약이 아직 없습니다" />
        </Panel>
        <Panel eyebrow="TOP SELLERS" title="이번 달 거래액 TOP 셀러" action={{ href: "/admin/users", label: "전체" }}>
          <RankList items={d.topSellers} empty="이번 달 결제된 주문이 없습니다" />
        </Panel>
        <Panel eyebrow="DISTRIBUTION" title="결제수단 · 지역 분포" className="lg:col-span-2 2xl:col-span-1">
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500">이번 달 결제수단</p>
            {d.methods.length === 0 ? <p className="text-sm text-slate-400">결제 데이터가 없습니다</p> : d.methods.map((m) => (
              <Meter key={m.method} label={PAYMENT_METHOD[m.method] ?? m.method} value={m._sum.amount ?? 0} max={d!.methods.reduce((s, x) => s + (x._sum.amount ?? 0), 0)} right={`${compactKRW(m._sum.amount ?? 0)} · ${m._count}건`} tone="navy" />
            ))}
            <p className="pt-2 text-xs font-bold text-slate-500">지역별 운영 창고(스튜디오)</p>
            {d.regions.length === 0 ? <p className="text-sm text-slate-400">운영 중인 공간이 없습니다</p> : d.regions.slice(0, 6).map((r) => (
              <Meter key={r.region} label={r.region} value={r._count} max={d!.facApproved} right={`${r._count}곳`} tone="sky" />
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel eyebrow="LIVE" title="라이브 방송 현황" action={{ href: "/admin/live-settings", label: "라이브 설정" }}>
          {d.liveNow.length + d.upcomingLives.length === 0 ? <Empty icon={Radio} text="진행 중이거나 예정된 방송이 없습니다" /> : (
            <ul className="space-y-2">
              {d.liveNow.map((l) => (
                <li key={l.id}>
                  <Link href={`/live/${l.slug}`} className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-3 hover:bg-rose-50">
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500 text-white"><Radio className="h-5 w-5" /><span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-rose-400" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-navy">{l.title}</span><span className="block truncate text-xs text-slate-500">{nameOf(l.seller)} · {(l.facility?.name ?? "셀러 공간")}</span></span>
                    <Pill tone="red">LIVE · 주문 {l._count.orders}</Pill>
                  </Link>
                </li>
              ))}
              {d.upcomingLives.map((l) => {
                const p = kstParts(l.scheduledStart!);
                return (
                  <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-[#EEEAE2] p-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-center text-[11px] font-bold leading-tight text-white">{p.month}/{p.day}<br />{String(p.hour).padStart(2, "0")}:{String(p.minute).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-navy">{l.title}</span><span className="block truncate text-xs text-slate-500">{nameOf(l.seller)} · {(l.facility?.name ?? "셀러 공간")}</span></span>
                    <Pill tone="blue">{relativeTime(l.scheduledStart!)}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel eyebrow="ACTIVITY" title="최근 활동" action={{ href: "/admin/audit-logs", label: "감사 로그" }}>
          <Feed items={feed} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel eyebrow="NEW MEMBERS" title="최근 가입 회원" action={{ href: "/admin/users", label: "전체 보기" }}>
          <ul className="divide-y divide-[#F0ECE6]">
            {d.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">{nameOf(u).slice(0, 1)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-navy">{nameOf(u)}</span><span className="block truncate text-xs text-slate-500">{u.email}</span></span>
                <span className="text-right">
                  <Pill tone={roleTone[u.role as keyof typeof roleTone] ?? "slate"}>{ROLE_NAME[u.role] ?? u.role}</Pill>
                  <span className="mt-1 block text-[11px] text-slate-400">{u.lastLoginAt ? `접속 ${relativeTime(u.lastLoginAt)}` : `가입 ${relativeTime(u.createdAt)}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel eyebrow="SHORTCUTS" title="빠른 이동">
          <ShortcutGrid cols="sm:grid-cols-2" items={[
            { title: "회원 관리", desc: "역할·상태·메모 관리", href: "/admin/users", icon: Users, tone: "green" },
            { title: "창고(스튜디오) 승인", desc: "등록 공간 검토", href: "/admin/facilities", icon: Building2, tone: "sky", badge: d.facPending },
            { title: "예약 관리", desc: "예약 요청과 상태", href: "/admin/bookings", icon: ClipboardList, tone: "violet", badge: d.pendingBookingsAll },
            { title: "정산 관리", desc: "정산서 확정·지급", href: "/admin/settlements", icon: Wallet, tone: "green", badge: d.todo.pendingSettlements },
            { title: "고객 문의", desc: "1:1 문의 답변", href: "/admin/support", icon: Headset, tone: "blue", badge: d.todo.supportWaiting },
            { title: "마케팅 지원", desc: "셀러 캠페인 관리", href: "/admin/marketing", icon: Megaphone, tone: "violet" },
            { title: "사이트 설정", desc: "배너·기본 정보", href: "/admin/site-settings", icon: Settings2, tone: "slate" },
            { title: "감사 로그", desc: "관리 작업 이력", href: "/admin/audit-logs", icon: ScrollText, tone: "navy" },
          ]} />
        </Panel>
      </div>

      <Link href="/admin/site-management" className="group flex items-center justify-between gap-4 rounded-[22px] bg-navy p-5 text-white transition hover:bg-navy-700 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-brand-300"><Globe className="h-6 w-6" /></span>
          <div>
            <p className="font-bold">사이트 화면도 함께 관리하세요</p>
            <p className="mt-1 text-sm text-white/60">공개 페이지의 주요 설정과 콘텐츠를 확인할 수 있습니다.</p>
          </div>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-brand-300" />
      </Link>
    </div>
  );
}
