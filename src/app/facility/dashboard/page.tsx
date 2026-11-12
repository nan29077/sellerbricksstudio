import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { reportDbError, type DbIssue } from "@/lib/db-error";
import { requireRole } from "@/lib/auth";
import { runBookingMaintenance } from "@/lib/booking-automation";
import { ownedFacilityIds as ownedIdsForMaintenance } from "@/lib/rbac";
import { ownedFacilityIds } from "@/lib/rbac";
import { addDays, addMonths, hhmm, kstParts, kstStartOfDay, kstStartOfMonth, WEEKDAYS } from "@/lib/kst";
import {
  SOLD_ORDER_STATUSES, compactKRW, dailySeries, deltaPct, greeting, hoursText, openHoursPerDay, overlapHours, ratio,
  relativeTime, todayLabel, utilization, weekdayHourHeatmap, zipSeries,
} from "@/lib/dashboard";
import { ProductMixPanel } from "@/components/dashboard/product-mix";
import {
  DashHero, DataNotice, DayTimeline, Empty, Feed, HeroButton, HeroPanel, Heatmap, KpiTile, Meter, Panel, Pill, RankList,
  ShortcutGrid, TodoList, TrendChart,
} from "@/components/dashboard/kit";
import {
  BadgeAlert, Building2, CalendarCheck, CalendarClock, CalendarDays, CircleDollarSign, ClipboardCheck, FileText, Gauge as GaugeIcon,
  MessageSquare, Package, PackagePlus, Radio, Repeat, ShoppingBag, Star, Store, Wallet, Warehouse,
} from "lucide-react";

export const dynamic = "force-dynamic";

const sellerName = (s: { email: string; profile: { name: string | null; companyName?: string | null } | null }) => s.profile?.name || s.email.split("@")[0];

async function load(userId: string) {
  const facIds = await ownedFacilityIds(userId);
  if (facIds.length === 0) return { empty: true as const };

  const now = new Date();
  const today = kstStartOfDay(now);
  const monthStart = kstStartOfMonth(now);
  const nextMonth = addMonths(monthStart, 1);
  const lastMonthStart = addMonths(monthStart, -1);
  const lastMonthSameDay = new Date(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()));
  const d90 = addDays(today, -90);
  const inFac = { facilityId: { in: facIds } };

  const [
    facilities, bookings, todayBookings, pendingAll, stalePending, orders, topProducts, reviewAgg, latestReviews,
    toComplete, unrepliedReviews, unreadInquiries, missingSetup, liveNow,
  ] = await Promise.all([
    prisma.facility.findMany({ where: { id: { in: facIds } }, select: { id: true, name: true, region: true, type: true, status: true, rating: true, openTime: true, closeTime: true, autoApprove: true } }),
    prisma.booking.findMany({ where: { ...inFac, OR: [{ startAt: { gte: d90 } }, { createdAt: { gte: lastMonthStart } }] }, select: { facilityId: true, sellerId: true, status: true, startAt: true, endAt: true, createdAt: true, approvedAt: true } }),
    prisma.booking.findMany({
      where: { ...inFac, status: { in: ["APPROVED", "PENDING", "COMPLETED"] }, startAt: { lt: addDays(today, 1) }, endAt: { gt: today } }, orderBy: { startAt: "asc" },
      select: { id: true, status: true, startAt: true, endAt: true, facilityId: true, seller: { select: { email: true, profile: { select: { name: true, companyName: true } } } } },
    }),
    prisma.booking.count({ where: { ...inFac, status: "PENDING" } }),
    prisma.booking.count({ where: { ...inFac, status: "PENDING", createdAt: { lt: addDays(now, -0.5) } } }),
    prisma.order.findMany({ where: { ...inFac, status: { in: [...SOLD_ORDER_STATUSES] }, createdAt: { gte: addDays(today, -29) < lastMonthStart ? addDays(today, -29) : lastMonthStart } }, select: { createdAt: true, totalAmount: true, refundedAmount: true } }),
    prisma.orderItem.groupBy({ by: ["productName"], where: { order: { ...inFac, status: { in: [...SOLD_ORDER_STATUSES] }, createdAt: { gte: monthStart } } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 5 }),
    prisma.facilityReview.aggregate({ where: { ...inFac, isHidden: false }, _avg: { rating: true }, _count: true }),
    prisma.facilityReview.findMany({ where: { ...inFac, isHidden: false }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, rating: true, content: true, reply: true, createdAt: true, facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } } }),
    prisma.booking.count({ where: { ...inFac, status: "APPROVED", endAt: { lt: now } } }),
    prisma.facilityReview.count({ where: { ...inFac, reply: null } }),
    prisma.facilityInquiry.count({ where: { ...inFac, isRead: false } }),
    prisma.facility.count({ where: { id: { in: facIds }, OR: [{ bankAccount: null }, { cancelPolicy: null }] } }),
    prisma.liveSession.count({ where: { ...inFac, status: "LIVE" } }),
  ]);

  const used = bookings.filter((b) => b.status === "APPROVED" || b.status === "COMPLETED");
  const daysInMonth = kstParts(addDays(nextMonth, -1)).day;
  const perFac = facilities.map((f) => {
    const mine = used.filter((b) => b.facilityId === f.id);
    const hours = overlapHours(mine, monthStart, nextMonth);
    return {
      ...f, hours,
      util: utilization(hours, openHoursPerDay(f), daysInMonth),
      monthCount: bookings.filter((b) => b.facilityId === f.id && b.startAt >= monthStart && b.startAt < nextMonth && b.status !== "CANCELLED" && b.status !== "REJECTED").length,
      pending: bookings.filter((b) => b.facilityId === f.id && b.status === "PENDING").length,
    };
  });
  const totalHours = perFac.reduce((s, f) => s + f.hours, 0);
  const totalCap = facilities.reduce((s, f) => s + openHoursPerDay(f) * daysInMonth, 0);

  const mReq = bookings.filter((b) => b.createdAt >= monthStart);
  const pReq = bookings.filter((b) => b.createdAt >= lastMonthStart && b.createdAt < lastMonthSameDay);
  const approvals = mReq.filter((b) => b.approvedAt).map((b) => (b.approvedAt!.getTime() - b.createdAt.getTime()) / 3600000);
  const avgApproval = approvals.length ? approvals.reduce((a, b) => a + b, 0) / approvals.length : null;

  const mOrders = orders.filter((o) => o.createdAt >= monthStart);
  const pOrders = orders.filter((o) => o.createdAt >= lastMonthStart && o.createdAt < lastMonthSameDay);
  const gmv = mOrders.reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0);

  // 90일 셀러 랭킹 · 재이용률
  const past90 = used.filter((b) => b.startAt >= d90 && b.startAt < now);
  const bySeller = new Map<string, { n: number; h: number }>();
  for (const b of past90) { const x = bySeller.get(b.sellerId) ?? { n: 0, h: 0 }; x.n += 1; x.h += (b.endAt.getTime() - b.startAt.getTime()) / 3600000; bySeller.set(b.sellerId, x); }
  const repeatRate = ratio([...bySeller.values()].filter((x) => x.n >= 2).length, bySeller.size);
  const top = [...bySeller.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5);
  const sellers = await prisma.user.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, email: true, profile: { select: { name: true, companyName: true } } } });

  // 향후 14일 부하
  const ahead = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i), n = addDays(d, 1), p = kstParts(d);
    const rows = bookings.filter((b) => b.startAt >= d && b.startAt < n && (b.status === "APPROVED" || b.status === "PENDING"));
    return { key: d.toISOString(), day: p.day, wd: WEEKDAYS[p.weekday], weekend: p.weekday === 0 || p.weekday === 6, n: rows.length, pending: rows.filter((r) => r.status === "PENDING").length };
  });

  const nowP = kstParts(now);
  return {
    empty: false as const,
    perFac, totalHours, util: totalCap ? Math.min(100, Math.round((totalHours / totalCap) * 100)) : 0,
    monthReq: mReq.length, reqDelta: deltaPct(mReq.length, pReq.length), avgApproval,
    pendingAll, stalePending, liveNow,
    gmv, gmvDelta: deltaPct(gmv, pOrders.reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0)), orderCount: mOrders.length,
    trend: zipSeries(
      dailySeries(orders.filter((o) => o.createdAt >= addDays(today, -29)), 30, (o) => o.createdAt, (o) => (o.totalAmount - o.refundedAmount)),
      dailySeries(used.filter((b) => b.startAt >= addDays(today, -29) && b.startAt < addDays(today, 1)), 30, (b) => b.startAt),
    ),
    heat: weekdayHourHeatmap(used.filter((b) => b.startAt >= d90).map((b) => b.startAt)),
    ahead, repeatRate, sellerCount: bySeller.size,
    topSellers: top.map(([id, v]) => { const u = sellers.find((s) => s.id === id); return { key: id, name: u ? sellerName(u) : "셀러", sub: `${u?.profile?.companyName ? u.profile.companyName + " · " : ""}${hoursText(v.h)} 이용`, value: v.n, valueLabel: `${v.n}회` }; }),
    topProducts, rating: reviewAgg._avg.rating, reviewCount: reviewAgg._count, latestReviews,
    nowHour: nowP.hour + nowP.minute / 60,
    timeline: facilities.map((f) => ({
      key: f.id, label: f.name,
      blocks: todayBookings.filter((b) => b.facilityId === f.id).map((b) => {
        const s = kstParts(b.startAt), e = kstParts(b.endAt);
        const sh = b.startAt < today ? 0 : s.hour + s.minute / 60;
        const eh = b.endAt >= addDays(today, 1) ? 24 : e.hour + e.minute / 60;
        return { key: b.id, start: sh, end: eh, title: sellerName(b.seller), sub: `${hhmm(b.startAt)}–${hhmm(b.endAt)}${b.status === "PENDING" ? " · 승인 대기" : ""}`, tone: (b.status === "PENDING" ? "amber" : b.status === "COMPLETED" ? "blue" : "green") as "amber" | "blue" | "green", href: "/facility/bookings?view=calendar" };
      }),
    })),
    todayCount: todayBookings.length,
    inUse: todayBookings.filter((b) => b.startAt <= now && b.endAt > now && b.status !== "PENDING").length,
    todo: { toComplete, unrepliedReviews, unreadInquiries, missingSetup },
  };
}

export default async function FacilityDashboard() {
  const user = await requireRole(["FACILITY_ADMIN"]);
  if (!user.id.startsWith("demo-")) await runBookingMaintenance({ facilityIds: await ownedIdsForMaintenance(user.id).catch(() => []) });
  let d: Awaited<ReturnType<typeof load>> | null = null;
  let issue: DbIssue = "unknown";
  try { d = await load(user.id); } catch (e) { issue = reportDbError("facility-dashboard", e); }
  const hello = `${greeting()}, ${user.name ?? "운영자"}님`;

  if (!d) return <div className="space-y-6"><DashHero eyebrow={`SPACE OPERATIONS · ${todayLabel()}`} title={hello} /><DataNotice issue={issue} /></div>;
  if (d.empty) {
    return (
      <div className="space-y-6">
        <DashHero eyebrow={`SPACE OPERATIONS · ${todayLabel()}`} title={hello}
          description="창고(스튜디오)를 등록하면 예약·일정·상품·판매 현황이 이곳에 모입니다. 이용료 없이 상품을 등록하고 셀러의 예약을 받아 보세요."
          actions={<HeroButton href="/facility/register" primary><Building2 className="h-4 w-4" />창고(스튜디오) 등록하기</HeroButton>} />
        <Empty icon={Warehouse} text="아직 등록된 창고(스튜디오)가 없습니다" action={{ href: "/facility/register", label: "등록 시작" }} />
      </div>
    );
  }

  const fmtHours = (h: number | null) => h === null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))}분` : `${Math.round(h * 10) / 10}시간`;
  const aheadMax = Math.max(1, ...d.ahead.map((x) => x.n));

  return (
    <div className="space-y-6 pb-6">
      <DashHero
        eyebrow={`SPACE OPERATIONS · ${todayLabel()}`}
        title={hello}
        description="오늘 일정과 승인 대기, 가동률·판매 성과를 확인하고 바로 처리하세요."
        chips={[
          ...(d.inUse ? [{ label: `지금 이용 중 ${d.inUse}건`, tone: "live" as const }] : []),
          ...(d.pendingAll ? [{ label: `승인 대기 ${d.pendingAll}건`, tone: "warn" as const }] : []),
          { label: `오늘 예약 ${d.todayCount}건` },
          ...(d.liveNow ? [{ label: `방송 중 ${d.liveNow}건`, tone: "live" as const }] : []),
        ]}
        actions={<><HeroButton href="/facility/bookings?status=PENDING" primary><ClipboardCheck className="h-4 w-4" />예약 승인하기</HeroButton><HeroButton href="/facility/schedule"><CalendarClock className="h-4 w-4" />운영 일정</HeroButton>{d.perFac[0] && <HeroButton href={`/facilities/${d.perFac[0].id}`}><Store className="h-4 w-4" />{d.perFac.length > 1 ? `샵 바로가기 · ${d.perFac[0].name}` : "샵 바로가기"}</HeroButton>}</>}
        aside={
          <HeroPanel title="이번 달 가동률" href="/facility/bookings?view=calendar" cta="예약 캘린더">
            <p className="text-4xl font-extrabold">{d.util}<span className="text-lg text-white/60">%</span></p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-brand-500" style={{ width: `${d.util}%` }} /></div>
            <p className="mt-2 text-xs text-white/65">예약 {hoursText(d.totalHours)} · 운영시간 기준 (창고 {d.perFac.length}곳)</p>
          </HeroPanel>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile label="이번 달 예약 신청" value={String(d.monthReq)} unit="건" delta={d.reqDelta} sub="전월 동기 대비" icon={CalendarCheck} tone="violet" href="/facility/bookings" />
        <KpiTile label="승인 대기" value={String(d.pendingAll)} unit="건" sub={`평균 응답 ${fmtHours(d.avgApproval)}`} icon={ClipboardCheck} tone={d.pendingAll ? "amber" : "green"} href="/facility/bookings?status=PENDING" />
        <KpiTile label="이번 달 이용 시간" value={hoursText(d.totalHours)} sub={`가동률 ${d.util}%`} icon={GaugeIcon} tone="sky" />
        <KpiTile emphasis label="공간 내 라이브 판매" value={compactKRW(d.gmv)} delta={d.gmvDelta} sub={`주문 ${d.orderCount}건`} icon={CircleDollarSign} tone="brand" spark={d.trend.map((x) => x.a)} href="/facility/orders" />
        <KpiTile label="평균 평점" value={d.rating ? d.rating.toFixed(2) : "—"} sub={`리뷰 ${d.reviewCount}개`} icon={Star} tone="amber" href="/facility/reviews" />
        <KpiTile label="재이용 셀러" value={`${d.repeatRate}%`} sub={`최근 90일 셀러 ${d.sellerCount}명`} icon={Repeat} tone="green" />
      </div>

      <Panel eyebrow="TODAY" title="오늘 이용 일정" action={{ href: "/facility/bookings?view=calendar", label: "캘린더 전체" }}>
        {d.todayCount === 0
          ? <Empty icon={CalendarDays} text={`오늘 예정된 이용이 없습니다. 내일 ${d.ahead[1]?.n ?? 0}건 예정`} />
          : <DayTimeline rows={d.timeline} from={8} to={24} now={d.nowHour} />}
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-400" />확정</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-amber-400" />승인 대기</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-blue-400" />이용 완료</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-0.5 bg-rose-500" />현재 시각</span>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel eyebrow="LAST 30 DAYS" title="최근 30일 판매 · 이용 추이" action={{ href: "/facility/orders", label: "주문 보기" }}>
          <TrendChart data={d.trend} a={{ name: "판매액", format: compactKRW }} b={{ name: "이용 예약", format: (n) => `${n}건` }} />
        </Panel>
        <Panel eyebrow="TO DO" title="처리가 필요한 작업">
          <TodoList items={[
            { label: "12시간 넘게 대기 중인 예약", desc: "빠른 응답이 재예약으로 이어져요", n: d.stalePending, href: "/facility/bookings?status=PENDING", icon: BadgeAlert, tone: "red", urgent: true },
            { label: "승인 대기 예약", n: d.pendingAll - d.stalePending, href: "/facility/bookings?status=PENDING", icon: ClipboardCheck, tone: "amber" },
            { label: "'이용 완료' 처리가 필요한 예약", desc: "이용이 끝난 확정 예약이에요", n: d.todo.toComplete, href: "/facility/bookings?status=APPROVED&sort=upcoming", icon: CalendarCheck, tone: "blue" },
            { label: "읽지 않은 셀러 문의", n: d.todo.unreadInquiries, href: "/facility/inquiries", icon: MessageSquare, tone: "violet" },
            { label: "답글을 기다리는 리뷰", n: d.todo.unrepliedReviews, href: "/facility/reviews?filter=unreplied", icon: Star, tone: "amber" },
            { label: "정산 계좌·취소 규정 미입력", n: d.todo.missingSetup, href: "/facility/profile", icon: FileText, tone: "slate" },
          ]} emptyText="모든 작업을 처리했어요" />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="NEXT 14 DAYS" title="향후 2주 예약 현황" action={{ href: "/facility/schedule", label: "일정 관리" }}>
          <div className="grid grid-cols-7 gap-1.5">
            {d.ahead.map((x, i) => (
              <div key={x.key} title={`${x.day}일 예약 ${x.n}건${x.pending ? ` (대기 ${x.pending})` : ""}`}
                className={`rounded-xl border p-1.5 text-center ${i === 0 ? "border-brand-300 bg-brand-50" : "border-[#EEEAE2]"}`}>
                <p className={`text-[11px] font-bold ${x.weekend ? "text-rose-500" : "text-slate-400"}`}>{x.wd}</p>
                <p className="text-sm font-extrabold text-navy">{x.day}</p>
                <div className="mx-auto mt-1 flex h-8 w-3 items-end overflow-hidden rounded-full bg-[#F1EEE8]"><div className="w-full rounded-full bg-navy" style={{ height: `${(x.n / aheadMax) * 100}%` }} /></div>
                <p className="mt-1 text-[11px] font-bold text-slate-600">{x.n}{x.pending ? <span className="text-amber-600">·{x.pending}</span> : ""}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">막대는 하루 예약 건수, 주황 숫자는 승인 대기 건수입니다.</p>
        </Panel>
        <Panel eyebrow="PEAK TIME · 90 DAYS" title="인기 이용 시간대">
          <Heatmap {...d.heat} />
          <p className="mt-2 text-[11px] text-slate-400">비어 있는 시간대에 운영 시간이나 상품 구성을 조정해 보세요.</p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel eyebrow="MY SPACES" title="창고(스튜디오)별 현황" action={{ href: "/facility/profile", label: "정보 관리" }} className="2xl:col-span-1">
          <div className="space-y-4">
            {d.perFac.map((f) => (
              <div key={f.id} className="rounded-2xl border border-[#EEEAE2] p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-navy">{f.name}</span>
                  {f.status !== "APPROVED" && <Pill tone={f.status === "PENDING" ? "amber" : "red"}>{f.status === "PENDING" ? "승인 심사 중" : "운영 정지"}</Pill>}
                  {f.autoApprove && <Pill tone="green">즉시 확정</Pill>}
                  <Link href={`/facilities/${f.id}`} className="shrink-0 text-xs font-bold text-brand-700 hover:underline">샵 바로가기</Link>
                </div>
                <Meter label={`${f.region} · ${f.type === "WAREHOUSE" ? "창고" : "스튜디오"} · ★ ${f.rating.toFixed(1)}`} value={f.util} max={100} right={`가동률 ${f.util}%`} tone={f.util >= 80 ? "red" : f.util >= 40 ? "brand" : "green"}
                  sub={`이번 달 ${f.monthCount}건 · ${hoursText(f.hours)}${f.pending ? ` · 대기 ${f.pending}건` : ""}`} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel eyebrow="TOP SELLERS · 90 DAYS" title="단골 셀러" action={{ href: "/facility/bookings", label: "예약 보기" }}>
          <RankList items={d.topSellers} empty="최근 90일 이용 기록이 없습니다" />
        </Panel>
        <Panel eyebrow="BEST PRODUCTS" title="이번 달 인기 상품" action={{ href: "/facility/products", label: "상품 관리" }} className="lg:col-span-2 2xl:col-span-1">
          <RankList empty="이번 달 판매된 상품이 없습니다"
            items={d.topProducts.map((p) => ({ key: p.productName, name: p.productName, sub: `${(p._sum.quantity ?? 0).toLocaleString("ko-KR")}개 판매`, value: p._sum.lineTotal ?? 0, valueLabel: compactKRW(p._sum.lineTotal ?? 0) }))} />
        </Panel>
      </div>

      <ProductMixPanel scope={{ facilityIds: d.perFac.map((f) => f.id) }} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel eyebrow="REVIEWS" title="최근 리뷰" action={{ href: "/facility/reviews", label: "리뷰 관리" }}>
          <Feed empty="아직 받은 리뷰가 없습니다" items={d.latestReviews.map((r) => ({
            key: r.id, title: `${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} ${r.content.slice(0, 40)}${r.content.length > 40 ? "…" : ""}`,
            sub: `${sellerName(r.seller)} · ${r.facility.name}${r.reply ? " · 답글 완료" : " · 답글 대기"}`,
            time: relativeTime(r.createdAt), icon: Star, tone: r.rating <= 2 ? "red" as const : r.reply ? "green" as const : "amber" as const, href: "/facility/reviews",
          }))} />
        </Panel>
        <Panel eyebrow="SHORTCUTS" title="바로가기">
          <ShortcutGrid cols="sm:grid-cols-2" items={[
            { title: "예약 관리", desc: "승인·거절·이용 완료", href: "/facility/bookings", icon: CalendarDays, tone: "violet", badge: d.pendingAll },
            { title: "운영 일정", desc: "운영 시간·휴무일", href: "/facility/schedule", icon: CalendarClock, tone: "sky" },
            { title: "상품 등록", desc: "셀러가 판매할 상품", href: "/facility/products/new", icon: PackagePlus, tone: "brand" },
            { title: "상품 관리", desc: "재고·가격·수수료", href: "/facility/products", icon: Package, tone: "navy" },
            { title: "라이브 현황", desc: "공간에서 진행 중인 방송", href: "/facility/live-sessions", icon: Radio, tone: "red" },
            { title: "주문 · 출고", desc: "판매 주문 확인", href: "/facility/orders", icon: ShoppingBag, tone: "amber" },
            { title: "정산", desc: "정산서·지급 내역", href: "/facility/settlements", icon: Wallet, tone: "green" },
            { title: "공간 소개 페이지", desc: "셀러에게 보이는 화면", href: "/facility/pages", icon: Warehouse, tone: "slate" },
          ]} />
        </Panel>
      </div>
    </div>
  );
}
