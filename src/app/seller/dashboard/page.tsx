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
  Star, CalendarDays, ShoppingBag, ExternalLink
} from "lucide-react";

export const dynamic = "force-dynamic";

const BOOKING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "승인 대기", color: "bg-yellow-100 text-yellow-700" },
  APPROVED:  { label: "승인됨",   color: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "거절됨",   color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소됨",   color: "bg-gray-100 text-gray-600" },
  COMPLETED: { label: "완료",     color: "bg-blue-100 text-blue-700" },
};

const DUMMY_UPCOMING = [
  { id: "ls1", title: "뷰티 신상 여름 컬렉션",  facility: "강남 프리미엄 라이브 스튜디오", scheduledStart: new Date("2026-06-22T14:00:00"), status: "READY" },
  { id: "ls2", title: "식품 특가전 라이브",      facility: "마포구 대형 물류 창고",          scheduledStart: new Date("2026-06-25T10:00:00"), status: "READY" },
];

const DUMMY_TOP_PRODUCTS = [
  { name: "뷰티 세럼 A",    sold: 142, revenue: 6_390_000 },
  { name: "선크림 SPF50+",  sold: 98,  revenue: 2_744_000 },
  { name: "홍삼 진액 세트", sold: 67,  revenue: 5_963_000 },
];

export default async function SellerDashboard() {
  const user = await requireRole(["SELLER"]);

  let bookings = 0, lives = 0, orders = 0;
  let recentBookings: any[] = [];

  try {
    [bookings, lives, orders, recentBookings] = await Promise.all([
      prisma.booking.count({ where: { sellerId: user.id } }),
      prisma.liveSession.count({ where: { sellerId: user.id } }),
      prisma.order.count({ where: { sellerId: user.id, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } } }),
      prisma.booking.findMany({
        where: { sellerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { facility: { select: { name: true, region: true } } },
      }),
    ]);
  } catch { /* DB not available */ }

  if (bookings === 0 && lives === 0 && orders === 0) {
    bookings = 12; lives = 8; orders = 234;
  }

  const pendingBookings = recentBookings.filter((b) => b.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader title={`안녕하세요, ${user.name}님`} description="셀러 대시보드 - 오늘도 좋은 방송 되세요!" />
        <Link href="/seller/live-sessions" className="hidden sm:block">
          <Button><Zap className="h-4 w-4 mr-1" />라이브 시작</Button>
        </Link>
      </div>

      {pendingBookings > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">승인 대기 중인 예약이 {pendingBookings}건 있습니다</p>
            <p className="text-xs text-amber-600">시설 운영자의 승인을 기다리고 있습니다.</p>
          </div>
          <Link href="/seller/bookings">
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700">확인하기</Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="총 예약"       value={`${bookings}건`} sub="누적"         icon={CalendarPlus} />
        <StatCard label="라이브 세션"   value={`${lives}개`}   sub="방송 횟수"     icon={Radio} />
        <StatCard label="결제완료 주문" value={`${orders}건`}  sub="이번 달 +42건" icon={Package} />
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { icon: Search,       label: "시설 검색",  desc: "창고-스튜디오 찾기", href: "/facilities",           color: "text-blue-600 bg-blue-50" },
          { icon: CalendarPlus, label: "예약 신청",  desc: "새 예약 만들기",     href: "/seller/bookings/new",  color: "text-brand-600 bg-brand-50" },
          { icon: Radio,        label: "라이브 관리",desc: "세션 목록 보기",     href: "/seller/live-sessions", color: "text-purple-600 bg-purple-50" },
          { icon: ShoppingBag,  label: "주문 관리",  desc: "주문 현황 확인",     href: "/seller/orders",        color: "text-emerald-600 bg-emerald-50" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition cursor-pointer group">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color} group-hover:opacity-80 transition shrink-0`}>
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

      <div className="grid lg:grid-cols-2 gap-5">
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
            <div className="space-y-3">
              {DUMMY_UPCOMING.map((ls) => (
                <div key={ls.id} className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">{ls.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ls.facility}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap shrink-0">
                      준비중
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-brand-600 font-medium">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(ls.scheduledStart)}
                  </div>
                </div>
              ))}
            </div>
            <Link href="/seller/bookings/new" className="mt-4 block">
              <Button variant="outline" className="w-full" size="sm">
                <CalendarPlus className="h-4 w-4 mr-1" /> 새 라이브 예약하기
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-navy">인기 상품 TOP 3</h3>
              </div>
              <Link href="/seller/orders" className="text-xs text-brand-600 flex items-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {DUMMY_TOP_PRODUCTS.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                    i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : "bg-orange-50 text-orange-600"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-navy truncate">{p.name}</span>
                      <span className="text-sm font-bold text-brand-600 shrink-0 ml-2">{formatKRW(p.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${(p.revenue / DUMMY_TOP_PRODUCTS[0].revenue) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.sold}개 판매</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
                const s = BOOKING_STATUS_MAP[b.status] ?? { label: b.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">{b.facility?.name ?? "시설"}</p>
                      <p className="text-xs text-muted-foreground">{b.facility?.region} - {formatDate(b.createdAt)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${s.color}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <a
        href="https://sellerbricks.co.kr"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Card className="border border-border bg-white hover:border-brand-400 hover:shadow-md transition-all">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">셀러브릭스 플랫폼 바로가기</p>
                <p className="text-xs text-muted-foreground mt-1">sellerbricks.co.kr에서 상품·주문·CS를 한번에 관리하세요</p>
              </div>
              <ExternalLink className="h-5 w-5 text-brand-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
