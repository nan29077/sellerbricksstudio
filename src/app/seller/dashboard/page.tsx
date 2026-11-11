import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { reportDbError, type DbIssue } from "@/lib/db-error";
import { requireRole } from "@/lib/auth";
import { runBookingMaintenance } from "@/lib/booking-automation";
import { formatKRW } from "@/lib/utils";
import { addDays, addMonths, hhmm, kstParts, kstStartOfMonth, WEEKDAYS } from "@/lib/kst";
import { LIVE_STATUS } from "@/lib/status";
import { registeredSpaceThumbnail } from "@/lib/showcase";
import {
  SOLD_ORDER_STATUSES, compactKRW, dailySeries, dday, deltaPct, greeting, hoursText, monthlySeries, overlapHours, todayLabel, zipSeries,
} from "@/lib/dashboard";
import { ProductMixPanel } from "@/components/dashboard/product-mix";
import {
  DashHero, DataNotice, Empty, HeroButton, HeroPanel, KpiTile, Panel, Pill, RankList, ShortcutGrid, TodoList, TrendChart,
} from "@/components/dashboard/kit";
import {
  CalendarDays, CalendarPlus, CheckCircle2, CircleDollarSign, Clock, ExternalLink, Heart, MapPin, Megaphone,
  MessageSquare, PackageCheck, Radio, Search, Share2, ShoppingBag, Star, Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

const BOOKING_LABEL: Record<string, { label: string; tone: "amber" | "green" | "red" | "slate" | "blue" }> = {
  PENDING: { label: "승인 대기", tone: "amber" }, APPROVED: { label: "예약 확정", tone: "green" },
  REJECTED: { label: "거절", tone: "red" }, CANCELLED: { label: "취소", tone: "slate" }, COMPLETED: { label: "이용 완료", tone: "blue" },
};

async function load(userId: string) {
  const now = new Date();
  const monthStart = kstStartOfMonth(now);
  const lastMonthStart = addMonths(monthStart, -1);
  const lastMonthSameDay = new Date(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()));
  const sixStart = addMonths(monthStart, -5);
  const sold = { in: [...SOLD_ORDER_STATUSES] };

  const [
    orders, bookings, upcoming, lives, topProducts, settlePending, settlePaid,
    reviewTodo, repliedInquiries, activePromos, plannedPosts, toShip, notPrepared, favorites, frequent,
  ] = await Promise.all([
    prisma.order.findMany({ where: { sellerId: userId, status: sold, createdAt: { gte: sixStart < lastMonthStart ? sixStart : lastMonthStart } }, select: { createdAt: true, totalAmount: true, refundedAmount: true, liveSessionId: true } }),
    prisma.booking.findMany({ where: { sellerId: userId, createdAt: { gte: lastMonthStart } }, select: { createdAt: true, startAt: true, endAt: true, status: true } }),
    prisma.booking.findMany({
      where: { sellerId: userId, status: { in: ["APPROVED", "PENDING"] }, endAt: { gte: now } },
      orderBy: { startAt: "asc" }, take: 5,
      select: { id: true, status: true, startAt: true, endAt: true, purpose: true, facility: { select: { id: true, name: true, region: true, address: true } }, liveSession: { select: { id: true, status: true } } },
    }),
    prisma.liveSession.findMany({
      where: { sellerId: userId }, orderBy: [{ scheduledStart: "desc" }, { createdAt: "desc" }], take: 5,
      select: { id: true, title: true, status: true, scheduledStart: true, createdAt: true, facility: { select: { name: true } }, _count: { select: { orders: true, products: true } } },
    }),
    prisma.orderItem.groupBy({
      by: ["productName"], where: { order: { sellerId: userId, status: sold, createdAt: { gte: monthStart } } },
      _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 5,
    }),
    prisma.settlement.aggregate({ where: { sellerId: userId, status: { in: ["PENDING", "CONFIRMED"] } }, _sum: { commissionAmount: true }, _count: true }),
    prisma.settlement.aggregate({ where: { sellerId: userId, status: "PAID" }, _sum: { commissionAmount: true } }),
    prisma.booking.count({ where: { sellerId: userId, status: "COMPLETED", review: null } }),
    prisma.facilityInquiry.count({ where: { sellerId: userId, reply: { not: null }, repliedAt: { gte: addDays(now, -7) } } }),
    prisma.sellerPromotion.count({ where: { sellerId: userId, isPublished: true, startAt: { lte: now }, endAt: { gte: now } } }),
    prisma.snsPost.count({ where: { sellerId: userId, status: "PLANNED", scheduledAt: { gte: now, lt: addDays(now, 7) } } }),
    prisma.order.count({ where: { sellerId: userId, status: "PAID" } }),
    prisma.booking.findMany({ where: { sellerId: userId, status: "APPROVED", startAt: { gte: now, lt: addDays(now, 3) }, liveSession: null }, select: { id: true }, orderBy: { startAt: "asc" } }),
    prisma.facilityFavorite.findMany({ where: { userId }, take: 4, orderBy: { createdAt: "desc" }, select: { facility: { select: { id: true, name: true, region: true, type: true, rating: true, status: true } } } }),
    prisma.booking.groupBy({ by: ["facilityId"], where: { sellerId: userId, status: { in: ["APPROVED", "COMPLETED"] } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 4 }),
  ]);

  // 자주 찾는 공간: 찜 → 많이 이용한 곳 → 평점 높은 곳 순으로 채운다
  const picked = new Map<string, { id: string; name: string; region: string; type: "STUDIO" | "WAREHOUSE"; rating: number; tag: string }>();
  for (const f of favorites) if (f.facility.status === "APPROVED") picked.set(f.facility.id, { ...f.facility, tag: "찜" });
  if (picked.size < 4 && frequent.length) {
    const fs = await prisma.facility.findMany({ where: { id: { in: frequent.map((f) => f.facilityId) }, status: "APPROVED" }, select: { id: true, name: true, region: true, type: true, rating: true } });
    for (const g of frequent) { const f = fs.find((x) => x.id === g.facilityId); if (f && !picked.has(f.id) && picked.size < 4) picked.set(f.id, { ...f, tag: `${g._count.id}회 이용` }); }
  }
  if (picked.size < 4) {
    const rec = await prisma.facility.findMany({ where: { status: "APPROVED", id: { notIn: [...picked.keys()] } }, orderBy: { rating: "desc" }, take: 4 - picked.size, select: { id: true, name: true, region: true, type: true, rating: true } });
    for (const f of rec) picked.set(f.id, { ...f, tag: "추천" });
  }

  const mOrders = orders.filter((o) => o.createdAt >= monthStart);
  const pOrders = orders.filter((o) => o.createdAt >= lastMonthStart && o.createdAt < lastMonthSameDay);
  const gmv = mOrders.reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0);
  const mBookings = bookings.filter((b) => b.createdAt >= monthStart);
  const pBookings = bookings.filter((b) => b.createdAt < lastMonthSameDay);
  const usedHours = overlapHours(bookings.filter((b) => b.status === "APPROVED" || b.status === "COMPLETED"), monthStart, addMonths(monthStart, 1));

  const gmvBySession = new Map<string, number>();
  for (const o of orders) gmvBySession.set(o.liveSessionId, (gmvBySession.get(o.liveSessionId) ?? 0) + (o.totalAmount - o.refundedAmount));

  const liveMonths = await prisma.liveSession.findMany({ where: { sellerId: userId, status: { in: ["LIVE", "ENDED"] }, createdAt: { gte: sixStart } }, select: { createdAt: true, scheduledStart: true } });

  return {
    gmv, gmvDelta: deltaPct(gmv, pOrders.reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0)),
    orderCount: mOrders.length, aov: mOrders.length ? gmv / mOrders.length : 0,
    bookingCount: mBookings.length, bookingDelta: deltaPct(mBookings.length, pBookings.length), usedHours,
    gmvDaily: dailySeries(orders.filter((o) => o.createdAt >= addDays(now, -29)), 30, (o) => o.createdAt, (o) => (o.totalAmount - o.refundedAmount)),
    trend: zipSeries(
      monthlySeries(orders.filter((o) => o.createdAt >= sixStart), 6, (o) => o.createdAt, (o) => (o.totalAmount - o.refundedAmount)),
      monthlySeries(liveMonths, 6, (l) => l.scheduledStart ?? l.createdAt),
    ),
    upcoming, lives: lives.map((l) => ({ ...l, gmv: gmvBySession.get(l.id) ?? 0 })),
    topProducts, spaces: [...picked.values()],
    settlePending: settlePending._sum.commissionAmount ?? 0, settlePendingCount: settlePending._count, settlePaid: settlePaid._sum.commissionAmount ?? 0,
    pendingBookings: upcoming.filter((b) => b.status === "PENDING").length,
    todo: { reviewTodo, repliedInquiries, activePromos, plannedPosts, toShip, notPrepared },
  };
}

export default async function SellerDashboard() {
  const user = await requireRole(["SELLER"]);
  if (!user.id.startsWith("demo-")) await runBookingMaintenance({ sellerId: user.id });
  let d: Awaited<ReturnType<typeof load>> | null = null;
  let issue: DbIssue = "unknown";
  try { d = await load(user.id); } catch (e) { issue = reportDbError("seller-dashboard", e); }

  const hello = `${greeting()}, ${user.name ?? "셀러"}님`;
  if (!d) {
    return <div className="space-y-6"><DashHero eyebrow={`SELLER · ${todayLabel()}`} title={hello} /><DataNotice issue={issue} /></div>;
  }

  const next = d.upcoming[0];
  const np = next && kstParts(next.startAt);

  return (
    <div className="space-y-6 pb-6">
      <DashHero
        eyebrow={`SELLER STUDIO · ${todayLabel()}`}
        title={hello}
        description="공간 예약부터 라이브 판매, 정산까지 — 오늘 챙길 일과 성과를 한눈에 확인하세요. 창고(스튜디오) 이용료는 무료입니다."
        chips={[
          ...(d.todo.notPrepared.length ? [{ label: `라이브 준비 필요 ${d.todo.notPrepared.length}건`, tone: "warn" as const }] : []),
          ...(d.pendingBookings ? [{ label: `승인 대기 ${d.pendingBookings}건` }] : []),
          { label: `이번 달 공간 이용 ${hoursText(d.usedHours)}` },
        ]}
        actions={<><HeroButton href="/seller/bookings/new" primary><CalendarPlus className="h-4 w-4" />공간 예약하기</HeroButton><HeroButton href="/facilities"><Search className="h-4 w-4" />창고(스튜디오) 찾기</HeroButton></>}
        aside={
          next && np ? (
            <HeroPanel title="다음 일정" href={next.liveSession ? `/seller/live-sessions/${next.liveSession.id}` : next.status === "APPROVED" ? `/seller/live-sessions?bookingId=${next.id}` : "/seller/bookings"} cta={next.liveSession ? "라이브 관리" : next.status === "APPROVED" ? "라이브 준비하기" : "예약 확인"}>
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-500 text-center text-navy">
                  <span><span className="block text-[11px] font-bold">{np.month}월</span><span className="block text-xl font-extrabold leading-none">{np.day}</span></span>
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5"><span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-extrabold text-brand-200">{dday(next.startAt)}</span><span className="text-xs text-white/60">{BOOKING_LABEL[next.status]?.label}</span></p>
                  <p className="mt-1 truncate font-bold">{next.facility.name}</p>
                  <p className="text-xs text-white/65">{WEEKDAYS[np.weekday]}요일 {hhmm(next.startAt)}–{hhmm(next.endAt)}</p>
                </div>
              </div>
            </HeroPanel>
          ) : (
            <HeroPanel title="다음 일정" href="/facilities" cta="공간 둘러보기">
              <p className="text-sm text-white/75">예정된 예약이 없어요. 상품이 준비된 창고(스튜디오)를 찾아 첫 방송을 잡아 보세요.</p>
            </HeroPanel>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile emphasis label="이번 달 라이브 매출" value={compactKRW(d.gmv)} delta={d.gmvDelta} sub="전월 동기 대비" icon={CircleDollarSign} tone="brand" spark={d.gmvDaily.map((x) => x.value)} href="/seller/orders" />
        <KpiTile label="결제 완료 주문" value={d.orderCount.toLocaleString("ko-KR")} unit="건" sub={`객단가 ${compactKRW(d.aov)}`} icon={ShoppingBag} tone="navy" href="/seller/orders" />
        <KpiTile label="이번 달 예약" value={String(d.bookingCount)} unit="건" delta={d.bookingDelta} sub={`이용 ${hoursText(d.usedHours)}`} icon={CalendarDays} tone="violet" href="/seller/bookings" />
        <KpiTile label="정산 예정 수익" value={compactKRW(d.settlePending)} sub={`누적 수령 ${compactKRW(d.settlePaid)}`} icon={Wallet} tone="green" href="/seller/settlements" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel eyebrow="6 MONTHS" title="월별 라이브 매출 · 방송 횟수" action={{ href: "/seller/settlements", label: "정산 보기" }}>
          <TrendChart data={d.trend} a={{ name: "매출", format: compactKRW }} b={{ name: "방송", format: (n) => `${n}회` }} height={180} />
        </Panel>
        <Panel eyebrow="TO DO" title="지금 챙길 일">
          <TodoList items={[
            { label: "라이브 준비가 필요한 예약", desc: "3일 안에 이용하는데 방송이 아직 없어요", n: d.todo.notPrepared.length, href: d.todo.notPrepared[0] ? `/seller/live-sessions?bookingId=${d.todo.notPrepared[0].id}` : "/seller/live-sessions", icon: Radio, tone: "red", urgent: true },
            { label: "발송 준비할 주문", desc: "결제가 끝난 주문을 처리하세요", n: d.todo.toShip, href: "/seller/orders", icon: PackageCheck, tone: "brand" },
            { label: "리뷰를 기다리는 이용 완료 예약", desc: "후기를 남기면 다음 예약에 도움이 돼요", n: d.todo.reviewTodo, href: "/seller/bookings?status=COMPLETED", icon: Star, tone: "amber" },
            { label: "최근 7일 답변 받은 문의", n: d.todo.repliedInquiries, href: "/seller/farm-reservations?tab=inquiries", icon: MessageSquare, tone: "blue" },
            { label: "진행 중인 이벤트", n: d.todo.activePromos, href: "/seller/marketing/events?status=ACTIVE", icon: Megaphone, tone: "violet" },
            { label: "7일 내 게시 예정 콘텐츠", n: d.todo.plannedPosts, href: "/seller/marketing", icon: Share2, tone: "sky" },
          ]} emptyText="밀린 일이 없어요. 다음 방송을 준비해 볼까요?" />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="SCHEDULE" title="다가오는 일정" action={{ href: "/seller/bookings?view=calendar", label: "캘린더" }}>
          {d.upcoming.length === 0 ? <Empty icon={CalendarDays} text="다가오는 예약이 없습니다" action={{ href: "/seller/bookings/new", label: "예약 신청하기" }} /> : (
            <ul className="space-y-2">
              {d.upcoming.map((b) => {
                const p = kstParts(b.startAt);
                const s = BOOKING_LABEL[b.status];
                return (
                  <li key={b.id}>
                    <Link href="/seller/bookings" className="flex items-center gap-3 rounded-2xl border border-[#EEEAE2] p-3 transition hover:border-brand-300 hover:bg-brand-50/40">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F6F2E9] text-center text-navy">
                        <span><span className="block text-[11px] font-bold text-slate-500">{WEEKDAYS[p.weekday]}</span><span className="block text-lg font-extrabold leading-none">{p.day}</span></span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-navy">{b.facility.name}</span>
                        <span className="flex items-center gap-1 truncate text-xs text-slate-500"><Clock className="h-3 w-3 shrink-0" />{p.month}/{p.day} {hhmm(b.startAt)}–{hhmm(b.endAt)}<MapPin className="ml-1 h-3 w-3 shrink-0" />{b.facility.region}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Pill tone={s.tone}>{s.label}</Pill>
                        <span className="text-[11px] font-bold text-slate-500">{dday(b.startAt)}{b.status === "APPROVED" && (b.liveSession ? " · 방송 준비됨" : " · 방송 미등록")}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel eyebrow="BEST SELLERS" title="이번 달 인기 상품" action={{ href: "/seller/orders", label: "주문 보기" }}>
          <RankList empty="이번 달 판매된 상품이 아직 없습니다"
            items={d.topProducts.map((p) => ({ key: p.productName, name: p.productName, sub: `${(p._sum.quantity ?? 0).toLocaleString("ko-KR")}개 판매`, value: p._sum.lineTotal ?? 0, valueLabel: compactKRW(p._sum.lineTotal ?? 0) }))} />
        </Panel>
      </div>

      <ProductMixPanel scope={{ sellerId: user.id }} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel eyebrow="LIVE REPORT" title="최근 라이브 성과" action={{ href: "/seller/live-sessions", label: "라이브 관리" }}>
          {d.lives.length === 0 ? <Empty icon={Radio} text="아직 진행한 라이브가 없습니다" action={{ href: "/seller/live-sessions", label: "라이브 만들기" }} /> : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="text-left text-[11px] font-bold text-slate-400"><th className="px-1 pb-2">방송</th><th className="px-1 pb-2">상태</th><th className="px-1 pb-2 text-right">상품</th><th className="px-1 pb-2 text-right">주문</th><th className="px-1 pb-2 text-right">매출</th></tr></thead>
                <tbody className="divide-y divide-[#F0ECE6]">
                  {d.lives.map((l) => {
                    const st = LIVE_STATUS[l.status];
                    const when = l.scheduledStart ?? l.createdAt;
                    const tone = l.status === "LIVE" ? "red" : l.status === "READY" ? "blue" : "slate";
                    return (
                      <tr key={l.id}>
                        <td className="max-w-0 px-1 py-2.5"><Link href={`/seller/live-sessions/${l.id}`} className="block truncate font-bold text-navy hover:text-brand-700">{l.title}</Link><span className="block truncate text-[11px] text-slate-500">{kstParts(when).month}/{kstParts(when).day} · {(l.facility?.name ?? "셀러 공간")}</span></td>
                        <td className="px-1 py-2.5"><Pill tone={tone}>{st?.label ?? l.status}</Pill></td>
                        <td className="px-1 py-2.5 text-right text-slate-600">{l._count.products}</td>
                        <td className="px-1 py-2.5 text-right text-slate-600">{l._count.orders}</td>
                        <td className="px-1 py-2.5 text-right font-extrabold text-navy">{formatKRW(l.gmv)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel eyebrow="MY SPACES" title="자주 찾는 창고(스튜디오)" action={{ href: "/facilities", label: "더 찾기" }}>
          {d.spaces.length === 0 ? <Empty icon={Heart} text="등록된 창고(스튜디오)가 없습니다" /> : (
            <ul className="space-y-2">
              {d.spaces.map((f) => (
                <li key={f.id}>
                  <Link href={`/facilities/${f.id}`} className="flex items-center gap-3 rounded-2xl border border-[#EEEAE2] p-2.5 transition hover:border-brand-300 hover:bg-brand-50/40">
                    <Image src={registeredSpaceThumbnail(f.id, f.type)} alt="" width={72} height={54} unoptimized className="h-12 w-16 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-navy">{f.name}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{f.region} · {f.type === "WAREHOUSE" ? "창고" : "스튜디오"} · <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{f.rating.toFixed(1)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1"><Pill tone={f.tag === "찜" ? "red" : f.tag === "추천" ? "brand" : "violet"}>{f.tag}</Pill><span className="text-[11px] font-bold text-emerald-600">이용료 무료</span></span>
                  </Link>
                </li>
              ))}
              <p className="pt-1 text-[11px] text-slate-400">썸네일은 생성형 연출 이미지입니다</p>
            </ul>
          )}
        </Panel>
      </div>

      <Panel eyebrow="SHORTCUTS" title="바로가기">
        <ShortcutGrid cols="sm:grid-cols-2 xl:grid-cols-4" items={[
          { title: "예약 신청", desc: "새 공간 예약 만들기", href: "/seller/bookings/new", icon: CalendarPlus, tone: "brand" },
          { title: "라이브 관리", desc: "방송·상품번호 설정", href: "/seller/live-sessions", icon: Radio, tone: "red" },
          { title: "주문 관리", desc: "결제·발송 처리", href: "/seller/orders", icon: ShoppingBag, tone: "navy", badge: d.todo.toShip },
          { title: "정산 내역", desc: d.settlePendingCount ? `정산 예정 ${d.settlePendingCount}건` : "정산 현황 확인", href: "/seller/settlements", icon: Wallet, tone: "green" },
          { title: "마케팅 지원", desc: "SNS·광고 소재·이벤트", href: "/seller/marketing", icon: Megaphone, tone: "violet" },
          { title: "카카오 알림톡", desc: "구독자 알림 관리", href: "/seller/kakao", icon: MessageSquare, tone: "amber" },
          { title: "예약 캘린더", desc: "월간 일정 보기", href: "/seller/bookings?view=calendar", icon: CheckCircle2, tone: "sky" },
          { title: "스토리지마켓 플랫폼", desc: "sellerbricks.co.kr", href: "https://sellerbricks.co.kr", icon: ExternalLink, tone: "slate" },
        ]} />
      </Panel>
    </div>
  );
}
