import type { FacilityType } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { reportDbError, type DbIssue } from "@/lib/db-error";
import { requireRole } from "@/lib/auth";
import { runBookingMaintenance } from "@/lib/booking-automation";
import { formatKRW } from "@/lib/utils";
import { addDays, addMonths, hhmm, kstParts, kstStartOfMonth, WEEKDAYS } from "@/lib/kst";
import { ORDER_STATUS, facilityTypeLabel } from "@/lib/status";
import { livePlatformLabel } from "@/lib/live-platforms";
import { registeredSpaceThumbnail } from "@/lib/showcase";
import {
  SOLD_ORDER_STATUSES, compactKRW, dailySeries, dday, deltaPct, greeting, hoursText, monthlySeries, overlapHours, todayLabel, zipSeries,
} from "@/lib/dashboard";
import { ProductMixPanel } from "@/components/dashboard/product-mix";
import {
  DashHero, DataNotice, Empty, HeroButton, HeroPanel, KpiTile, Panel, Pill, RankList, ShortcutGrid, TodoList, TrendChart,
} from "@/components/dashboard/kit";
import {
  CalendarDays, CalendarPlus, CheckCircle2, CircleDollarSign, Clock, ExternalLink, FileText, Heart, MapPin, Megaphone,
  MessageSquare, PackageCheck, Search, Share2, ShoppingBag, SquarePlus, Star, Truck, Wallet,
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
    orders, bookings, upcoming, sheets, topProducts, shipping, paidTotal,
    reviewTodo, repliedInquiries, activePromos, plannedPosts, toShip, favorites, frequent,
  ] = await Promise.all([
    prisma.order.findMany({ where: { sellerId: userId, source: "SHEET", status: sold, createdAt: { gte: sixStart < lastMonthStart ? sixStart : lastMonthStart } }, select: { createdAt: true, totalAmount: true, refundedAmount: true } }),
    prisma.booking.findMany({ where: { sellerId: userId, createdAt: { gte: lastMonthStart } }, select: { createdAt: true, startAt: true, endAt: true, status: true } }),
    prisma.booking.findMany({
      where: { sellerId: userId, status: { in: ["APPROVED", "PENDING"] }, endAt: { gte: now } },
      orderBy: { startAt: "asc" }, take: 5,
      select: { id: true, status: true, startAt: true, endAt: true, purpose: true, facility: { select: { id: true, name: true, region: true, address: true } } },
    }),
    prisma.order.findMany({
      where: { sellerId: userId, source: "SHEET", status: { not: "PAYMENT_PENDING" } }, orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, orderNo: true, status: true, createdAt: true, platform: true, externalOrderNo: true, buyerName: true, totalAmount: true, refundedAmount: true, _count: { select: { items: true } } },
    }),
    prisma.orderItem.groupBy({
      by: ["productName"], where: { order: { sellerId: userId, source: "SHEET", status: sold, createdAt: { gte: monthStart } } },
      _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 5,
    }),
    prisma.order.count({ where: { sellerId: userId, source: "SHEET", status: "SHIPPED" } }),
    prisma.order.aggregate({ where: { sellerId: userId, source: "SHEET", status: { in: [...SOLD_ORDER_STATUSES] } }, _sum: { totalAmount: true, refundedAmount: true } }),
    prisma.booking.count({ where: { sellerId: userId, status: "COMPLETED", review: null } }),
    prisma.facilityInquiry.count({ where: { sellerId: userId, reply: { not: null }, repliedAt: { gte: addDays(now, -7) } } }),
    prisma.sellerPromotion.count({ where: { sellerId: userId, isPublished: true, startAt: { lte: now }, endAt: { gte: now } } }),
    prisma.snsPost.count({ where: { sellerId: userId, status: "PLANNED", scheduledAt: { gte: now, lt: addDays(now, 7) } } }),
    prisma.order.count({ where: { sellerId: userId, source: "SHEET", status: { in: ["PAID", "PREPARING"] } } }),
    prisma.facilityFavorite.findMany({ where: { userId }, take: 4, orderBy: { createdAt: "desc" }, select: { facility: { select: { id: true, name: true, region: true, type: true, rating: true, status: true } } } }),
    prisma.booking.groupBy({ by: ["facilityId"], where: { sellerId: userId, status: { in: ["APPROVED", "COMPLETED"] } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 4 }),
  ]);

  // 자주 찾는 공간: 찜 → 많이 이용한 곳 → 평점 높은 곳 순으로 채운다
  const picked = new Map<string, { id: string; name: string; region: string; type: FacilityType; rating: number; tag: string }>();
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


  return {
    gmv, gmvDelta: deltaPct(gmv, pOrders.reduce((s, o) => s + (o.totalAmount - o.refundedAmount), 0)),
    orderCount: mOrders.length, aov: mOrders.length ? gmv / mOrders.length : 0,
    bookingCount: mBookings.length, bookingDelta: deltaPct(mBookings.length, pBookings.length), usedHours,
    gmvDaily: dailySeries(orders.filter((o) => o.createdAt >= addDays(now, -29)), 30, (o) => o.createdAt, (o) => (o.totalAmount - o.refundedAmount)),
    trend: zipSeries(
      monthlySeries(orders.filter((o) => o.createdAt >= sixStart), 6, (o) => o.createdAt, (o) => (o.totalAmount - o.refundedAmount)),
      monthlySeries(orders.filter((o) => o.createdAt >= sixStart), 6, (o) => o.createdAt),
    ),
    upcoming, sheets,
    topProducts, spaces: [...picked.values()],
    shipping, paidTotal: (paidTotal._sum.totalAmount ?? 0) - (paidTotal._sum.refundedAmount ?? 0),
    pendingBookings: upcoming.filter((b) => b.status === "PENDING").length,
    todo: { reviewTodo, repliedInquiries, activePromos, plannedPosts, toShip },
    flow: await loadFlow(userId, now),
  };
}

// 방송 준비 흐름: 고른 상품 → 예정 방송 → 시연품 준비 → 판매 주문서
async function loadFlow(userId: string, now: Date) {
  const [listings, upcomingBookings, displayItems] = await Promise.all([
    prisma.sellerBrandProduct.count({ where: { sellerId: userId, isActive: true } }),
    prisma.booking.count({ where: { sellerId: userId, status: { in: ["PENDING", "APPROVED"] }, startAt: { gte: now } } }),
    prisma.bookingBrandItem.findMany({
      where: { booking: { sellerId: userId, status: "APPROVED", startAt: { gte: now } } },
      select: { brandRequest: { select: { status: true } } },
    }),
  ]);
  const arrived = displayItems.filter((i) => i.brandRequest?.status === "COMPLETED").length;
  return { listings, upcomingBookings, displayTotal: displayItems.length, displayArrived: arrived };
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
        description="브랜드 상품을 고르고 공간만 예약하면, 방송 날 그 자리에 시연품이 준비돼요. 판매분은 주문서로 내면 브랜드가 고객에게 바로 보냅니다."
        chips={[
          ...(d.todo.toShip ? [{ label: `출고 준비 중 주문서 ${d.todo.toShip}건` }] : []),
          ...(d.pendingBookings ? [{ label: `승인 대기 ${d.pendingBookings}건` }] : []),
          { label: `이번 달 공간 이용 ${hoursText(d.usedHours)}` },
        ]}
        actions={<><HeroButton href="/seller/brands" primary><ShoppingBag className="h-4 w-4" />방송 상품 고르기</HeroButton><HeroButton href="/seller/bookings/new"><CalendarPlus className="h-4 w-4" />방송 예약하기</HeroButton><HeroButton href="/seller/orders/new"><SquarePlus className="h-4 w-4" />주문서 작성</HeroButton></>}
        aside={
          next && np ? (
            <HeroPanel title="다음 일정" href="/seller/bookings" cta="예약 확인">
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
              <p className="text-sm text-white/75">예정된 예약이 없어요. 상품이 준비된 공간을 찾아 방송 공간을 예약해 보세요.</p>
            </HeroPanel>
          )
        }
      />

      <nav aria-label="방송 준비 흐름" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { n: 1, title: "방송 상품 고르기", value: `${d.flow.listings.toLocaleString()}개`, hint: "판매 중인 내 방송 상품", href: d.flow.listings ? "/seller/brand-products" : "/seller/brands" },
          { n: 2, title: "공간 · 날짜 예약", value: `${d.flow.upcomingBookings.toLocaleString()}건`, hint: "다가오는 방송 예약", href: d.flow.upcomingBookings ? "/seller/bookings" : "/seller/bookings/new" },
          { n: 3, title: "시연품 준비", value: d.flow.displayTotal ? `${d.flow.displayArrived}/${d.flow.displayTotal}` : "—", hint: d.flow.displayTotal ? "공간에 도착한 시연품" : "예약에 상품을 담으면 표시돼요", href: "/seller/bookings?status=APPROVED" },
          { n: 4, title: "판매 · 주문서", value: `${d.todo.toShip.toLocaleString()}건`, hint: "출고 준비 중 주문서", href: "/seller/orders/new" },
        ].map((s) => (
          <Link key={s.n} href={s.href} className="group min-w-0 rounded-2xl border border-[#E9E5DC] bg-white p-3.5 shadow-sm transition hover:border-brand-300 hover:shadow-md sm:p-4">
            <p className="flex items-center gap-2 text-[11px] font-extrabold text-brand-700"><span className="grid h-5 w-5 place-items-center rounded-full bg-navy text-[10px] text-white">{s.n}</span>STEP {s.n}</p>
            <p className="mt-2 truncate text-sm font-extrabold text-navy">{s.title}</p>
            <p className="mt-1 text-xl font-black tracking-tight text-navy">{s.value}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 group-hover:text-slate-700">{s.hint}</p>
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile emphasis label="이번 달 주문서 결제액" value={compactKRW(d.gmv)} delta={d.gmvDelta} sub="전월 동기 대비" icon={CircleDollarSign} tone="brand" spark={d.gmvDaily.map((x) => x.value)} href="/seller/settlements" />
        <KpiTile label="이번 달 주문서" value={d.orderCount.toLocaleString("ko-KR")} unit="건" sub={`건당 ${compactKRW(d.aov)}`} icon={FileText} tone="navy" href="/seller/orders" />
        <KpiTile label="이번 달 예약" value={String(d.bookingCount)} unit="건" delta={d.bookingDelta} sub={`이용 ${hoursText(d.usedHours)}`} icon={CalendarDays} tone="violet" href="/seller/bookings" />
        <KpiTile label="배송 중" value={String(d.shipping)} unit="건" sub={`누적 결제 ${compactKRW(d.paidTotal)}`} icon={Truck} tone="green" href="/seller/orders?status=SHIPPED" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel eyebrow="6 MONTHS" title="월별 주문서 결제액 · 건수" action={{ href: "/seller/settlements", label: "결제 내역" }}>
          <TrendChart data={d.trend} a={{ name: "결제액", format: compactKRW }} b={{ name: "주문서", format: (n) => `${n}건` }} height={180} />
        </Panel>
        <Panel eyebrow="TO DO" title="지금 챙길 일">
          <TodoList items={[
            { label: "출고 준비 중인 주문서", desc: "브랜드 · 스토리지마켓이 보낼 준비를 하고 있어요", n: d.todo.toShip, href: "/seller/orders?status=PAID", icon: PackageCheck, tone: "brand" },
            { label: "리뷰를 기다리는 이용 완료 예약", desc: "후기를 남기면 다음 예약에 도움이 돼요", n: d.todo.reviewTodo, href: "/seller/bookings?status=COMPLETED", icon: Star, tone: "amber" },
            { label: "최근 7일 답변 받은 문의", n: d.todo.repliedInquiries, href: "/seller/farm-reservations?tab=inquiries", icon: MessageSquare, tone: "blue" },
            { label: "진행 중인 이벤트", n: d.todo.activePromos, href: "/seller/marketing/events?status=ACTIVE", icon: Megaphone, tone: "violet" },
            { label: "7일 내 게시 예정 콘텐츠", n: d.todo.plannedPosts, href: "/seller/marketing", icon: Share2, tone: "sky" },
          ]} emptyText="밀린 일이 없어요. 판매한 주문이 있으면 주문서를 작성해 주세요." />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="SCHEDULE" title="다가오는 일정" action={{ href: "/seller/bookings?view=calendar", label: "캘린더" }}>
          {d.upcoming.length === 0 ? <Empty icon={CalendarDays} text="다가오는 예약이 없어요" action={{ href: "/seller/bookings/new", label: "예약 신청하기" }} /> : (
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
                        <span className="text-[11px] font-bold text-slate-500">{dday(b.startAt)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel eyebrow="BEST SELLERS" title="이번 달 주문서 인기 상품" action={{ href: "/seller/orders", label: "주문서 보기" }}>
          <RankList empty="이번 달 판매된 상품이 아직 없습니다"
            items={d.topProducts.map((p) => ({ key: p.productName, name: p.productName, sub: `${(p._sum.quantity ?? 0).toLocaleString("ko-KR")}개 주문`, value: p._sum.lineTotal ?? 0, valueLabel: compactKRW(p._sum.lineTotal ?? 0) }))} />
        </Panel>
      </div>

      <ProductMixPanel scope={{ sellerId: user.id }} requestsHref="/seller/brand-requests" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel eyebrow="ORDER SHEETS" title="최근 주문서" action={{ href: "/seller/orders", label: "주문서 · 배송 현황" }}>
          {d.sheets.length === 0 ? <Empty icon={FileText} text="아직 낸 주문서가 없어요" action={{ href: "/seller/orders/new", label: "주문서 작성" }} /> : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm rtable">
                <thead><tr className="text-left text-[11px] font-bold text-slate-400"><th className="px-1 pb-2">주문서</th><th className="px-1 pb-2">상태</th><th className="px-1 pb-2 text-right">상품</th><th className="px-1 pb-2 text-right">결제액</th></tr></thead>
                <tbody className="divide-y divide-[#F0ECE6]">
                  {d.sheets.map((o) => {
                    const st = ORDER_STATUS[o.status];
                    const tone = o.status === "DELIVERED" ? "blue" : o.status === "SHIPPED" ? "green" : o.status === "CANCELLED" || o.status === "REFUNDED" ? "slate" : "amber";
                    const p = kstParts(o.createdAt);
                    return (
                      <tr key={o.id}>
                        <td data-label="주문서" className="max-w-0 px-1 py-2.5"><Link href={`/seller/orders?q=${encodeURIComponent(o.orderNo)}`} className="block truncate font-bold text-navy hover:text-brand-700">{o.buyerName} · {o.orderNo}</Link><span className="block truncate text-[11px] text-slate-500">{p.month}/{p.day} · {livePlatformLabel(o.platform)}{o.externalOrderNo ? ` · ${o.externalOrderNo}` : ""}</span></td>
                        <td data-label="상태" className="px-1 py-2.5"><Pill tone={tone}>{st?.label ?? o.status}</Pill></td>
                        <td data-label="상품" className="px-1 py-2.5 text-right text-slate-600">{o._count.items}</td>
                        <td data-label="결제액" className="px-1 py-2.5 text-right font-extrabold text-navy">{formatKRW(o.totalAmount - o.refundedAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel eyebrow="MY SPACES" title="자주 찾는 공간" action={{ href: "/facilities", label: "더 찾기" }}>
          {d.spaces.length === 0 ? <Empty icon={Heart} text="등록된 공간이 없습니다" /> : (
            <ul className="space-y-2">
              {d.spaces.map((f) => (
                <li key={f.id}>
                  <Link href={`/facilities/${f.id}`} className="flex items-center gap-3 rounded-2xl border border-[#EEEAE2] p-2.5 transition hover:border-brand-300 hover:bg-brand-50/40">
                    <Image src={registeredSpaceThumbnail(f.id, f.type)} alt="" width={72} height={54} unoptimized className="h-12 w-16 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-navy">{f.name}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{f.region} · {facilityTypeLabel(f.type)} · <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{f.rating.toFixed(1)}</span>
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
          { title: "① 브랜드 상품 고르기", desc: "방송할 상품 담기", href: "/seller/brands", icon: Star, tone: "amber" },
          { title: "② 방송 예약하기", desc: "공간 · 날짜 · 방송 상품 선택", href: "/seller/bookings/new", icon: CalendarPlus, tone: "red" },
          { title: "③ 주문서 작성", desc: "화면 입력 · 엑셀 업로드", href: "/seller/orders/new", icon: SquarePlus, tone: "brand" },
          { title: "④ 결제 · 정산 내역", desc: "주문서 결제 · 환불", href: "/seller/settlements", icon: Wallet, tone: "green" },
          { title: "내 방송 상품", desc: "판매가 · 판매 여부 관리", href: "/seller/brand-products", icon: ShoppingBag, tone: "violet" },
          { title: "주문서 · 배송 현황", desc: "출고 · 운송장 확인", href: "/seller/orders", icon: ShoppingBag, tone: "navy", badge: d.todo.toShip },
          { title: "예약 캘린더", desc: "월간 방송 일정 보기", href: "/seller/bookings?view=calendar", icon: CheckCircle2, tone: "sky" },
          { title: "마케팅 지원", desc: "SNS · 광고 소재 · 이벤트", href: "/seller/marketing", icon: Megaphone, tone: "slate" },
        ]} />
      </Panel>
    </div>
  );
}
