import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { reportDbError, type DbIssue } from "@/lib/db-error";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { calcManagerCommission, managerFeeRows } from "@/lib/manager-commission";
import { formatKRW } from "@/lib/utils";
import { addDays, addMonths, hhmm, kstParts, kstStartOfDay, kstStartOfMonth, WEEKDAYS } from "@/lib/kst";
import {
  SOLD_ORDER_STATUSES, compactKRW, dailySeries, dday, deltaPct, greeting, hoursText, monthlySeries, openHoursPerDay, overlapHours,
  relativeTime, todayLabel, utilization, zipSeries,
} from "@/lib/dashboard";
import {
  DashHero, DataNotice, Empty, Feed, HeroButton, HeroPanel, KpiTile, Panel, Pill, ShortcutGrid, TodoList, TrendChart,
} from "@/components/dashboard/kit";
import {
  BadgeAlert, BarChart3, Building2, CalendarDays, CircleDollarSign, ClipboardCheck, Coins, Gauge as GaugeIcon, Settings,
  ShoppingBag, Star, TrendingDown, Users,
} from "lucide-react";
import { facilityTypeLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "red" | "slate" | "blue" }> = {
  PENDING: { label: "승인 대기", tone: "amber" }, APPROVED: { label: "확정", tone: "green" },
  REJECTED: { label: "거절", tone: "red" }, CANCELLED: { label: "취소", tone: "slate" }, COMPLETED: { label: "이용 완료", tone: "blue" },
};
const nameOf = (s: { email: string; profile: { name: string | null } | null }) => s.profile?.name || s.email.split("@")[0];

async function load(userId: string) {
  const facIds = await managerFacilityIds(userId);
  const rule = await prisma.managerCommissionRule.findUnique({ where: { managerId: userId } });
  if (facIds.length === 0) return { empty: true as const, rule };

  const now = new Date();
  const today = kstStartOfDay(now);
  const monthStart = kstStartOfMonth(now);
  const nextMonth = addMonths(monthStart, 1);
  const lastMonthStart = addMonths(monthStart, -1);
  const lastMonthSameDay = new Date(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()));
  const sixStart = addMonths(monthStart, -5);
  const inFac = { facilityId: { in: facIds } };
  const bookingSelect = { id: true, status: true, startAt: true, endAt: true, createdAt: true, facility: { select: { name: true } }, seller: { select: { email: true, profile: { select: { name: true } } } } } as const;

  const monthFee = (await managerFeeRows(facIds, monthStart).catch(() => [])).filter((f) => f.at < nextMonth).reduce((s, f) => s + f.fee, 0);
  const [facilities, bookings, orders, ratings, upcoming, recent, stalePending] = await Promise.all([
    prisma.facility.findMany({ where: { id: { in: facIds } }, select: { id: true, name: true, region: true, type: true, status: true, rating: true, openTime: true, closeTime: true } }),
    prisma.booking.findMany({ where: { ...inFac, OR: [{ startAt: { gte: sixStart } }, { createdAt: { gte: sixStart } }] }, select: { facilityId: true, sellerId: true, status: true, startAt: true, endAt: true, createdAt: true } }),
    prisma.order.findMany({ where: { ...inFac, status: { in: [...SOLD_ORDER_STATUSES] }, createdAt: { gte: sixStart } }, select: { facilityId: true, createdAt: true, totalAmount: true, refundedAmount: true } }),
    prisma.facilityReview.groupBy({ by: ["facilityId"], where: { ...inFac, isHidden: false }, _avg: { rating: true }, _count: true }),
    prisma.booking.findMany({ where: { ...inFac, status: { in: ["APPROVED", "PENDING"] }, startAt: { gte: now } }, orderBy: { startAt: "asc" }, take: 5, select: bookingSelect }),
    prisma.booking.findMany({ where: inFac, orderBy: { createdAt: "desc" }, take: 6, select: bookingSelect }),
    prisma.booking.count({ where: { ...inFac, status: "PENDING", createdAt: { lt: addDays(now, -1) } } }),
  ]);

  const daysInMonth = kstParts(addDays(nextMonth, -1)).day;
  const used = bookings.filter((b) => b.status === "APPROVED" || b.status === "COMPLETED");
  const perFac = facilities.map((f) => {
    const hours = overlapHours(used.filter((b) => b.facilityId === f.id), monthStart, nextMonth);
    const r = ratings.find((x) => x.facilityId === f.id);
    return {
      ...f, hours, util: utilization(hours, openHoursPerDay(f), daysInMonth),
      monthCount: bookings.filter((b) => b.facilityId === f.id && b.createdAt >= monthStart).length,
      pending: bookings.filter((b) => b.facilityId === f.id && b.status === "PENDING").length,
      gmv: orders.filter((o) => o.facilityId === f.id && o.createdAt >= monthStart).reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0),
      avgRating: r?._avg.rating ?? null, reviews: r?._count ?? 0,
    };
  }).sort((a, b) => b.monthCount - a.monthCount || b.gmv - a.gmv);

  const mReq = bookings.filter((b) => b.createdAt >= monthStart);
  const pReq = bookings.filter((b) => b.createdAt >= lastMonthStart && b.createdAt < lastMonthSameDay);
  const mOrders = orders.filter((o) => o.createdAt >= monthStart);
  const gmv = mOrders.reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0);
  const gmvPrev = orders.filter((o) => o.createdAt >= lastMonthStart && o.createdAt < lastMonthSameDay).reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0);
  const completedThisMonth = bookings.filter((b) => b.status === "COMPLETED" && b.startAt >= monthStart && b.startAt < nextMonth).length;
  const approvedThisMonth = bookings.filter((b) => b.status === "APPROVED" && b.startAt >= monthStart && b.startAt < nextMonth).length;
  const totalHours = perFac.reduce((s, f) => s + f.hours, 0);
  const cap = facilities.reduce((s, f) => s + openHoursPerDay(f) * daysInMonth, 0);

  return {
    empty: false as const, rule, perFac, gmv, gmvDelta: deltaPct(gmv, gmvPrev), orderCount: mOrders.length,
    monthReq: mReq.length, reqDelta: deltaPct(mReq.length, pReq.length),
    pending: bookings.filter((b) => b.status === "PENDING").length, stalePending,
    sellers: new Set(used.filter((b) => b.startAt >= addDays(today, -90)).map((b) => b.sellerId)).size,
    util: cap ? Math.min(100, Math.round((totalHours / cap) * 100)) : 0, totalHours,
    completedThisMonth, approvedThisMonth,
    commission: calcManagerCommission(rule, monthFee, completedThisMonth),
    commissionForecast: calcManagerCommission(rule, monthFee, completedThisMonth + approvedThisMonth),
    spark: dailySeries(orders.filter((o) => o.createdAt >= addDays(today, -29)), 30, (o) => o.createdAt, (o) => (o.totalAmount - o.refundedAmount)).map((x) => x.value),
    trend: zipSeries(
      monthlySeries(orders, 6, (o) => o.createdAt, (o) => (o.totalAmount - o.refundedAmount)),
      monthlySeries(bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "REJECTED"), 6, (b) => b.startAt),
    ),
    upcoming, recent,
  };
}

export default async function ManagerDashboard() {
  const user = await requireRole(["MANAGER"]);
  let d: Awaited<ReturnType<typeof load>> | null = null;
  let issue: DbIssue = "unknown";
  try { d = await load(user.id); } catch (e) { issue = reportDbError("manager-dashboard", e); }
  const hello = `${greeting()}, ${user.name ?? "매니저"}님`;

  if (!d) return <div className="space-y-6"><DashHero eyebrow={`MANAGER · ${todayLabel()}`} title={hello} /><DataNotice issue={issue} /></div>;

  const ruleText = d.rule ? (d.rule.commissionType === "PERCENT" ? `판매 수수료의 ${d.rule.commissionValue}%` : `이용 완료 1건당 ${formatKRW(d.rule.commissionValue)}`) : "커미션 규칙 미설정";

  if (d.empty) {
    return (
      <div className="space-y-6">
        <DashHero eyebrow={`MANAGER · ${todayLabel()}`} title={hello} description="최고관리자가 담당 창고(스튜디오)를 배정하면 예약·판매·커미션 현황이 이곳에 표시됩니다." chips={[{ label: ruleText }]} />
        <Empty icon={Building2} text="아직 배정된 담당 창고(스튜디오)가 없습니다" />
      </div>
    );
  }

  const weak = d.perFac.filter((f) => f.status === "APPROVED" && f.monthCount === 0).length;
  const lowRated = d.perFac.filter((f) => f.avgRating !== null && f.avgRating < 3.5).length;

  return (
    <div className="space-y-6 pb-6">
      <DashHero
        eyebrow={`MANAGER · ${todayLabel()}`}
        title={hello}
        description="담당 창고(스튜디오)의 예약 응답, 가동률, 판매 성과를 살피고 관리가 필요한 곳을 먼저 챙기세요."
        chips={[
          ...(d.stalePending ? [{ label: `24시간+ 대기 ${d.stalePending}건`, tone: "warn" as const }] : []),
          { label: `담당 ${d.perFac.length}곳` },
          { label: `평균 가동률 ${d.util}%` },
        ]}
        actions={<><HeroButton href="/manager/bookings?status=PENDING" primary><ClipboardCheck className="h-4 w-4" />대기 예약 보기</HeroButton><HeroButton href="/manager/sales"><BarChart3 className="h-4 w-4" />매출 리포트</HeroButton></>}
        aside={
          <HeroPanel title="이번 달 커미션" href="/manager/commissions" cta="커미션 상세">
            <p className="text-3xl font-extrabold">{formatKRW(d.commission)}</p>
            <p className="mt-1 text-xs text-white/65">확정 예약까지 포함하면 {formatKRW(d.commissionForecast)} 예상</p>
            <p className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-brand-200">{ruleText}</p>
          </HeroPanel>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile label="담당 창고(스튜디오)" value={String(d.perFac.length)} unit="곳" sub={`운영 ${d.perFac.filter((f) => f.status === "APPROVED").length}곳`} icon={Building2} tone="sky" href="/manager/facilities" />
        <KpiTile label="이번 달 예약 신청" value={String(d.monthReq)} unit="건" delta={d.reqDelta} sub="전월 동기 대비" icon={CalendarDays} tone="violet" href="/manager/bookings" />
        <KpiTile emphasis label="담당 공간 판매액" value={compactKRW(d.gmv)} delta={d.gmvDelta} sub={`주문 ${d.orderCount}건`} icon={CircleDollarSign} tone="brand" spark={d.spark} href="/manager/sales" />
        <KpiTile label="평균 가동률" value={`${d.util}%`} sub={`이용 ${hoursText(d.totalHours)}`} icon={GaugeIcon} tone="green" />
        <KpiTile label="승인 대기" value={String(d.pending)} unit="건" sub={d.stalePending ? `24시간+ ${d.stalePending}건` : "지연 없음"} icon={ClipboardCheck} tone={d.stalePending ? "red" : "amber"} href="/manager/bookings?status=PENDING" />
        <KpiTile label="이용 셀러" value={String(d.sellers)} unit="명" sub="최근 90일" icon={Users} tone="navy" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel eyebrow="6 MONTHS" title="월별 판매액 · 이용 예약" action={{ href: "/manager/sales", label: "매출 보기" }}>
          <TrendChart data={d.trend} a={{ name: "판매액", format: compactKRW }} b={{ name: "이용 예약", format: (n) => `${n}건` }} />
        </Panel>
        <Panel eyebrow="ATTENTION" title="관리가 필요한 곳">
          <TodoList items={[
            { label: "24시간 넘게 응답 없는 예약", desc: "창고(스튜디오)에 응답을 요청하세요", n: d.stalePending, href: "/manager/bookings?status=PENDING", icon: BadgeAlert, tone: "red", urgent: true },
            { label: "승인 대기 예약", n: d.pending - d.stalePending, href: "/manager/bookings?status=PENDING", icon: ClipboardCheck, tone: "amber" },
            { label: "이번 달 예약이 없는 창고(스튜디오)", desc: "상품·운영시간 점검이 필요해요", n: weak, href: "/manager/facilities", icon: TrendingDown, tone: "violet" },
            { label: "평균 평점 3.5 미만", desc: "리뷰를 확인하고 개선을 도와주세요", n: lowRated, href: "/manager/facilities", icon: Star, tone: "amber" },
            { label: "승인 심사 중인 담당 공간", n: d.perFac.filter((f) => f.status === "PENDING").length, href: "/manager/facilities", icon: Building2, tone: "sky" },
          ]} emptyText="담당 공간 모두 잘 운영되고 있어요" />
        </Panel>
      </div>

      <Panel eyebrow="PERFORMANCE" title="창고(스튜디오)별 이번 달 성과" action={{ href: "/manager/facilities", label: "전체 관리" }}>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm rtable">
            <thead><tr className="text-left text-[11px] font-bold text-slate-400">
              <th className="px-1 pb-2">창고(스튜디오)</th><th className="px-1 pb-2">가동률</th><th className="px-1 pb-2 text-right">예약</th><th className="px-1 pb-2 text-right">대기</th><th className="px-1 pb-2 text-right">판매액</th><th className="px-1 pb-2 text-right">평점</th>
            </tr></thead>
            <tbody className="divide-y divide-[#F0ECE6]">
              {d.perFac.map((f) => (
                <tr key={f.id}>
                  <td data-label="창고(스튜디오)" className="max-w-0 px-1 py-3">
                    <span className="flex items-center gap-1.5"><span className="truncate font-bold text-navy">{f.name}</span>{f.status !== "APPROVED" && <Pill tone={f.status === "PENDING" ? "amber" : "red"}>{f.status === "PENDING" ? "심사 중" : "정지"}</Pill>}</span>
                    <span className="block text-[11px] text-slate-500">{f.region} · {facilityTypeLabel(f.type)} · {hoursText(f.hours)}</span>
                  </td>
                  <td data-label="가동률" className="w-40 px-1 py-3">
                    <div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1EEE8]"><div className={`h-full rounded-full ${f.util >= 80 ? "bg-rose-400" : f.util >= 40 ? "bg-brand-500" : "bg-emerald-400"}`} style={{ width: `${f.util}%` }} /></div><span className="w-9 text-right text-xs font-bold text-navy">{f.util}%</span></div>
                  </td>
                  <td data-label="예약" className="px-1 py-3 text-right font-semibold text-navy">{f.monthCount}</td>
                  <td data-label="대기" className="px-1 py-3 text-right">{f.pending ? <Pill tone="amber">{f.pending}</Pill> : <span className="text-slate-300">0</span>}</td>
                  <td data-label="판매액" className="px-1 py-3 text-right font-extrabold text-navy">{compactKRW(f.gmv)}</td>
                  <td data-label="평점" className="px-1 py-3 text-right text-slate-600">{f.avgRating ? <span className={f.avgRating < 3.5 ? "font-bold text-rose-600" : ""}>★ {f.avgRating.toFixed(1)} <span className="text-[11px] text-slate-400">({f.reviews})</span></span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="UPCOMING" title="다가오는 예약" action={{ href: "/manager/bookings", label: "전체 보기" }}>
          {d.upcoming.length === 0 ? <Empty icon={CalendarDays} text="다가오는 예약이 없습니다" /> : (
            <ul className="space-y-2">
              {d.upcoming.map((b) => {
                const p = kstParts(b.startAt);
                return (
                  <li key={b.id} className="flex items-center gap-3 rounded-2xl border border-[#EEEAE2] p-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F6F2E9] text-center text-navy"><span><span className="block text-[11px] font-bold text-slate-500">{WEEKDAYS[p.weekday]}</span><span className="block text-lg font-extrabold leading-none">{p.day}</span></span></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-navy">{nameOf(b.seller)}</span><span className="block truncate text-xs text-slate-500">{b.facility.name} · {hhmm(b.startAt)}–{hhmm(b.endAt)}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-1"><Pill tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Pill><span className="text-[11px] font-bold text-slate-500">{dday(b.startAt)}</span></span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel eyebrow="ACTIVITY" title="최근 예약 활동" action={{ href: "/manager/bookings", label: "전체 보기" }}>
          <Feed empty="예약 내역이 없습니다" items={d.recent.map((b) => ({
            key: b.id, title: `${nameOf(b.seller)} · ${b.facility.name}`, sub: `${STATUS[b.status].label} · 이용 ${kstParts(b.startAt).month}/${kstParts(b.startAt).day} ${hhmm(b.startAt)}`,
            time: relativeTime(b.createdAt), icon: CalendarDays, tone: STATUS[b.status].tone, href: "/manager/bookings",
          }))} />
        </Panel>
      </div>

      <Panel eyebrow="SHORTCUTS" title="바로가기">
        <ShortcutGrid cols="sm:grid-cols-2 xl:grid-cols-5" items={[
          { title: "예약 관리", desc: "담당 공간 예약", href: "/manager/bookings", icon: CalendarDays, tone: "violet", badge: d.pending },
          { title: "담당 창고(스튜디오)", desc: "공간 정보·상태", href: "/manager/facilities", icon: Building2, tone: "sky" },
          { title: "매출 리포트", desc: "판매·주문 분석", href: "/manager/sales", icon: ShoppingBag, tone: "brand" },
          { title: "커미션", desc: "월별 수수료 내역", href: "/manager/commissions", icon: Coins, tone: "green" },
          { title: "설정", desc: "내 정보·알림", href: "/manager/settings", icon: Settings, tone: "slate" },
        ]} />
      </Panel>
      <p className="text-center text-[11px] text-slate-400"><Link href="/manager/commissions" className="hover:text-brand-700">커미션은 {ruleText} 기준으로 계산됩니다.</Link></p>
    </div>
  );
}
