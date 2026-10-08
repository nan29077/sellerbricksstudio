import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKRW, formatDate, formatDateTime } from "@/lib/utils";
import {
  CalendarPlus, Radio, Search, Package,
  Clock, ArrowRight, Zap,
  CalendarDays, ShoppingBag, ExternalLink,
  BarChart3, Wallet, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

export const dynamic = "force-dynamic";

const BOOKING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "승인 대기", color: "bg-yellow-100 text-yellow-700" },
  APPROVED:  { label: "승인됨",   color: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "거절됨",   color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소됨",   color: "bg-gray-100 text-gray-600" },
  COMPLETED: { label: "완료",     color: "bg-blue-100 text-blue-700" },
};

const LIVE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT:  { label: "초안",   color: "bg-gray-100 text-gray-600" },
  READY:  { label: "준비중", color: "bg-blue-100 text-blue-700" },
  LIVE:   { label: "방송중", color: "bg-red-100 text-red-600" },
  ENDED:  { label: "종료",   color: "bg-slate-100 text-slate-600" },
};

async function getDashboardData(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    bookings,
    lives,
    thisMonthOrders,
    lastMonthOrders,
    recentBookings,
    upcomingLiveSessions,
    topProducts,
    thisMonthRevenue,
    pendingSettlements,
  ] = await Promise.all([
    // 누적 예약 수
    prisma.booking.count({ where: { sellerId: userId } }),
    // 누적 라이브 세션 수
    prisma.liveSession.count({ where: { sellerId: userId } }),
    // 이번 달 결제 완료 주문 수
    prisma.order.count({
      where: {
        sellerId: userId,
        status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
        createdAt: { gte: monthStart },
      },
    }),
    // 지난달 결제 완료 주문 수 (증감 비교용)
    prisma.order.count({
      where: {
        sellerId: userId,
        status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
        createdAt: { gte: lastMonthStart, lt: monthStart },
      },
    }),
    // 최근 예약 5건
    prisma.booking.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { facility: { select: { name: true, region: true } } },
    }),
    // 다가오는 라이브 세션 (실제 DB)
    prisma.liveSession.findMany({
      where: {
        sellerId: userId,
        status: { in: ["DRAFT", "READY", "LIVE"] },
      },
      orderBy: [{ scheduledStart: "asc" }],
      take: 3,
      include: { facility: { select: { name: true, region: true } } },
    }),
    // 인기 상품 TOP 3 (실제 주문 데이터)
    prisma.orderItem.groupBy({
      by: ["productName"],
      where: {
        order: {
          sellerId: userId,
          status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
        },
      },
      _sum: { lineTotal: true, quantity: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 3,
    }),
    // 이번 달 총 매출
    prisma.order.aggregate({
      where: {
        sellerId: userId,
        status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
        createdAt: { gte: monthStart },
      },
      _sum: { totalAmount: true },
    }),
    // 대기 중인 정산 건수
    prisma.settlement.count({
      where: { sellerId: userId, status: "PENDING" },
    }),
  ]);

  return {
    bookings,
    lives,
    thisMonthOrders,
    orderDiff: thisMonthOrders - lastMonthOrders,
    recentBookings,
    upcomingLiveSessions,
    topProducts,
    thisMonthRevenue: thisMonthRevenue._sum.totalAmount ?? 0,
    pendingSettlements,
  };
}

export default async function SellerDashboard() {
  const user = await requireRole(["SELLER"]);

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    data = await getDashboardData(user.id);
  } catch {
    /* DB 연결 없을 때 무시 */
  }

  const bookings = data?.bookings ?? 0;
  const lives = data?.lives ?? 0;
  const thisMonthOrders = data?.thisMonthOrders ?? 0;
  const orderDiff = data?.orderDiff ?? 0;
  const thisMonthRevenue = data?.thisMonthRevenue ?? 0;
  const recentBookings = data?.recentBookings ?? [];
  const upcomingLiveSessions = data?.upcomingLiveSessions ?? [];
  const topProducts = data?.topProducts ?? [];
  const pendingSettlements = data?.pendingSettlements ?? 0;
  const pendingBookings = recentBookings.filter((b) => b.status === "PENDING").length;
  const maxRevenue = (topProducts[0]?._sum?.lineTotal ?? 1) || 1;

  const OrderDiffIcon = orderDiff > 0 ? TrendingUp : orderDiff < 0 ? TrendingDown : Minus;
  const orderDiffColor = orderDiff > 0 ? "text-emerald-600" : orderDiff < 0 ? "text-red-500" : "text-slate-400";
  const orderDiffLabel =
    orderDiff > 0 ? `전월 +${orderDiff}건` : orderDiff < 0 ? `전월 ${orderDiff}건` : "전월 동일";

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <PageHeader title={`안녕하세요, ${user.name}님`} description="셀러 대시보드 — 오늘도 좋은 방송 되세요!" />
        <Link href="/seller/live-sessions" className="hidden sm:block">
          <Button>
            <Zap className="h-4 w-4 mr-1" />
            라이브 시작
          </Button>
        </Link>
      </div>

      {/* 알림 배너: 승인 대기 예약 */}
      {pendingBookings > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              승인 대기 중인 예약이 {pendingBookings}건 있습니다
            </p>
            <p className="text-xs text-amber-600">시설 운영자의 승인을 기다리고 있습니다.</p>
          </div>
          <Link href="/seller/bookings">
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700">
              확인하기
            </Button>
          </Link>
        </div>
      )}

      {/* 알림 배너: 정산 대기 */}
      {pendingSettlements > 0 && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 flex items-center gap-3">
          <Wallet className="h-5 w-5 text-violet-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-violet-800">
              정산 대기 중인 항목이 {pendingSettlements}건 있습니다
            </p>
            <p className="text-xs text-violet-600">정산 현황을 확인해 주세요.</p>
          </div>
          <Link href="/seller/settlements">
            <Button variant="outline" size="sm" className="border-violet-300 text-violet-700">
              정산 보기
            </Button>
          </Link>
        </div>
      )}

      {/* 핵심 지표 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="누적 예약" value={`${bookings}건`} sub="전체 예약 합계" icon={CalendarPlus} />
        <StatCard label="라이브 세션" value={`${lives}개`} sub="방송 횟수 합계" icon={Radio} />
        <StatCard
          label="이번 달 주문"
          value={`${thisMonthOrders}건`}
          sub={orderDiffLabel}
          icon={Package}
        />
        <StatCard
          label="이번 달 매출"
          value={thisMonthRevenue > 0 ? formatKRW(thisMonthRevenue) : "—"}
          sub="결제 완료 기준"
          icon={Wallet}
        />
      </div>

      {/* 빠른 이동 */}
      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { icon: Search,       label: "시설 검색",  desc: "창고·스튜디오 찾기", href: "/facilities",           color: "text-blue-600 bg-blue-50" },
          { icon: CalendarPlus, label: "예약 신청",  desc: "새 예약 만들기",      href: "/seller/bookings/new",  color: "text-brand-600 bg-brand-50" },
          { icon: Radio,        label: "라이브 관리",desc: "세션 목록 보기",      href: "/seller/live-sessions", color: "text-purple-600 bg-purple-50" },
          { icon: ShoppingBag,  label: "주문 관리",  desc: "주문 현황 확인",      href: "/seller/orders",        color: "text-emerald-600 bg-emerald-50" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition cursor-pointer group">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color} group-hover:opacity-80 transition shrink-0`}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-navy text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 다가오는 라이브 + 인기 상품 */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* 다가오는 라이브 세션 — 실 DB */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-500" />
                <h3 className="font-bold text-navy">다가오는 라이브 일정</h3>
              </div>
              <Link href="/seller/live-sessions" className="text-xs text-brand-600 flex items-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {upcomingLiveSessions.length > 0 ? (
              <div className="space-y-3">
                {upcomingLiveSessions.map((ls) => {
                  const s = LIVE_STATUS_MAP[ls.status] ?? { label: ls.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <Link key={ls.id} href={`/seller/live-sessions/${ls.id}`} className="block">
                      <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 hover:bg-brand-50 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-navy truncate">{ls.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ls.facility.name} · {ls.facility.region}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${s.color}`}
                          >
                            {s.label}
                          </span>
                        </div>
                        {ls.scheduledStart && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-brand-600 font-medium">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(ls.scheduledStart)}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Radio className="h-8 w-8 mx-auto mb-2 opacity-30" />
                예정된 라이브 세션이 없습니다
              </div>
            )}
            <Link href="/seller/bookings/new" className="mt-4 block">
              <Button variant="outline" className="w-full" size="sm">
                <CalendarPlus className="h-4 w-4 mr-1" />
                새 라이브 예약하기
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 인기 상품 TOP 3 — 실 DB */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-navy">인기 상품 TOP 3</h3>
              </div>
              <Link href="/seller/orders" className="text-xs text-brand-600 flex items-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p, i) => {
                  const revenue = p._sum.lineTotal ?? 0;
                  const sold = p._sum.quantity ?? 0;
                  return (
                    <div key={p.productName} className="flex items-center gap-3">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                          i === 0
                            ? "bg-amber-100 text-amber-700"
                            : i === 1
                              ? "bg-gray-100 text-gray-600"
                              : "bg-orange-50 text-orange-600"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-navy truncate">{p.productName}</span>
                          <span className="text-sm font-bold text-brand-600 shrink-0 ml-2">
                            {formatKRW(revenue)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${(revenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{sold}개 판매</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                아직 판매 데이터가 없습니다
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 예약 — 실 DB */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy">최근 예약</h3>
            <Link href="/seller/bookings" className="text-xs text-brand-600 flex items-center gap-1">
              전체보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">예약 내역이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {recentBookings.map((b: any) => {
                const s =
                  BOOKING_STATUS_MAP[b.status] ?? { label: b.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">
                        {b.facility?.name ?? "시설"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.facility?.region} — {formatDate(b.createdAt)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 셀러브릭스 플랫폼 바로가기 */}
      <a href="https://sellerbricks.co.kr" target="_blank" rel="noopener noreferrer" className="block">
        <Card className="border border-border bg-white hover:border-brand-400 hover:shadow-md transition-all">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">셀러브릭스 플랫폼 바로가기</p>
                <p className="text-xs text-muted-foreground mt-1">
                  sellerbricks.co.kr에서 상품·주문·CS를 한번에 관리하세요
                </p>
              </div>
              <ExternalLink className="h-5 w-5 text-brand-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
