import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKRW, formatDate, formatDateTime } from "@/lib/utils";
import {
  CalendarPlus, Search, Clock, ArrowRight, Warehouse,
  CalendarDays, ExternalLink, TrendingUp, Wallet, Star,
  CheckCircle2, Building2, MapPin, Share2, Megaphone,
} from "lucide-react";

export const dynamic = "force-dynamic";

const BOOKING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "승인 대기", color: "bg-yellow-100 text-yellow-700" },
  APPROVED:  { label: "승인됨",   color: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "거절됨",   color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소됨",   color: "bg-gray-100 text-gray-600" },
  COMPLETED: { label: "완료",     color: "bg-blue-100 text-blue-700" },
};

async function getDashboardData(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalBookings,
    thisMonthBookings,
    pendingBookings,
    pendingSettlements,
    recentBookings,
    upcomingBookings,
    totalSettlementAmount,
    recommendedFacilities,
  ] = await Promise.all([
    // 누적 예약 수
    prisma.booking.count({ where: { sellerId: userId } }),
    // 이번 달 예약 수
    prisma.booking.count({
      where: { sellerId: userId, createdAt: { gte: monthStart } },
    }),
    // 승인 대기 수
    prisma.booking.count({ where: { sellerId: userId, status: "PENDING" } }),
    // 정산 대기 수
    prisma.settlement.count({ where: { sellerId: userId, status: "PENDING" } }),
    // 최근 예약 5건
    prisma.booking.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { facility: { select: { id: true, name: true, region: true, type: true } } },
    }),
    // 다가오는 승인된 예약
    prisma.booking.findMany({
      where: { sellerId: userId, status: "APPROVED", startAt: { gte: now } },
      orderBy: { startAt: "asc" },
      take: 3,
      include: { facility: { select: { id: true, name: true, region: true, type: true } } },
    }),
    // 완료된 정산 총액 (셀러 수익 = commissionAmount)
    prisma.settlement.aggregate({
      where: { sellerId: userId, status: "PAID" },
      _sum: { commissionAmount: true },
    }),
    // 추천 시설 (최신 승인 시설)
    prisma.facility.findMany({
      where: { status: "APPROVED" },
      orderBy: { rating: "desc" },
      take: 3,
      select: { id: true, name: true, type: true, region: true, basePrice: true, rating: true, thumbnailUrl: true },
    }),
  ]);

  return {
    totalBookings,
    thisMonthBookings,
    pendingBookings,
    pendingSettlements,
    recentBookings,
    upcomingBookings,
    totalSettlementAmount: totalSettlementAmount._sum.commissionAmount ?? 0,
    recommendedFacilities,
  };
}

export default async function SellerDashboard() {
  const user = await requireRole(["SELLER"]);

  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    data = await getDashboardData(user.id);
  } catch { /* DB 없을 때 */ }

  const totalBookings        = data?.totalBookings ?? 0;
  const thisMonthBookings    = data?.thisMonthBookings ?? 0;
  const pendingBookings      = data?.pendingBookings ?? 0;
  const pendingSettlements   = data?.pendingSettlements ?? 0;
  const recentBookings       = data?.recentBookings ?? [];
  const upcomingBookings     = data?.upcomingBookings ?? [];
  const totalSettlementAmount = data?.totalSettlementAmount ?? 0;
  const recommendedFacilities = data?.recommendedFacilities ?? [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <PageHeader
          title={`안녕하세요, ${user.name}님`}
          description="셀러 대시보드 — 창고·스튜디오를 예약하고 마케팅 지원을 받으세요"
        />
        <Link href="/facilities" className="hidden sm:block">
          <Button>
            <Search className="h-4 w-4 mr-1" />
            창고(스튜디오) 검색
          </Button>
        </Link>
      </div>

      {/* 승인 대기 알림 배너 */}
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

      {/* 정산 대기 배너 */}
      {pendingSettlements > 0 && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 flex items-center gap-3">
          <Wallet className="h-5 w-5 text-violet-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-violet-800">
              정산 대기 중인 항목이 {pendingSettlements}건 있습니다
            </p>
          </div>
          <Link href="/seller/settlements">
            <Button variant="outline" size="sm" className="border-violet-300 text-violet-700">
              정산 보기
            </Button>
          </Link>
        </div>
      )}

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="누적 예약"      value={`${totalBookings}건`}   sub="전체 예약 합계"        icon={CalendarPlus} />
        <StatCard label="이번 달 예약"   value={`${thisMonthBookings}건`} sub={`대기 ${pendingBookings}건`} icon={CalendarDays} />
        <StatCard label="수령 정산금"    value={totalSettlementAmount > 0 ? formatKRW(totalSettlementAmount) : "—"} sub="완료된 정산 합계" icon={Wallet} />
        <StatCard label="다가오는 예약"  value={`${upcomingBookings.length}건`} sub="승인된 예약"  icon={CheckCircle2} />
      </div>

      {/* 빠른 이동 */}
      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { icon: Search,     label: "창고·스튜디오 검색", desc: "시설 검색 및 예약",    href: "/facilities",          color: "text-blue-600 bg-blue-50" },
          { icon: CalendarPlus,label: "예약 신청",         desc: "새 예약 만들기",       href: "/seller/bookings/new", color: "text-brand-600 bg-brand-50" },
          { icon: Share2,     label: "SNS 마케팅",         desc: "마케팅 지원 활용",     href: "/seller/marketing",    color: "text-purple-600 bg-purple-50" },
          { icon: TrendingUp, label: "정산 내역",           desc: "정산 현황 확인",       href: "/seller/settlements",  color: "text-emerald-600 bg-emerald-50" },
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

      {/* 다가오는 예약 + 추천 시설 */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* 다가오는 예약 */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-500" />
                <h3 className="font-bold text-navy">다가오는 예약</h3>
              </div>
              <Link href="/seller/bookings" className="text-xs text-brand-600 flex items-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {upcomingBookings.map((b: any) => (
                  <Link key={b.id} href={`/facilities/${b.facility.id}`} className="block">
                    <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 hover:bg-brand-50 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">{b.facility.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {b.facility.region}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap shrink-0">
                          승인됨
                        </span>
                      </div>
                      {b.startAt && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-brand-600 font-medium">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(b.startAt)}
                        </div>
                      )}
                      {b.purpose && (
                        <p className="text-xs text-muted-foreground mt-1">목적: {b.purpose}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                다가오는 예약이 없습니다
              </div>
            )}
            <Link href="/seller/bookings/new" className="mt-4 block">
              <Button variant="outline" className="w-full" size="sm">
                <CalendarPlus className="h-4 w-4 mr-1" />
                새 예약 신청하기
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 추천 시설 */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-navy">추천 창고·스튜디오</h3>
              </div>
              <Link href="/facilities" className="text-xs text-brand-600 flex items-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {recommendedFacilities.length > 0 ? (
              <div className="space-y-3">
                {recommendedFacilities.map((f: any) => (
                  <Link key={f.id} href={`/facilities/${f.id}`} className="block">
                    <div className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-brand-300 hover:bg-brand-50/40 transition">
                      {f.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.thumbnailUrl} alt={f.name} className="h-12 w-16 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                          <Building2 className="h-6 w-6 text-brand-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy truncate">{f.name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {f.region} · {f.type === "WAREHOUSE" ? "창고" : "스튜디오"}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                            <span className="text-xs font-semibold text-navy">{f.rating.toFixed(1)}</span>
                          </div>
                          <span className="text-xs font-bold text-brand-600">
                            {formatKRW(f.basePrice)}/회
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-30" />
                등록된 시설이 없습니다
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 예약 */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy">최근 예약 내역</h3>
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

      {/* 마케팅 지원 배너 */}
      <Link href="/seller/marketing" className="block">
        <Card className="border border-purple-200 bg-gradient-to-r from-purple-50 to-brand-50 hover:shadow-md transition">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100">
                  <Megaphone className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-navy">마케팅 지원 센터</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SNS 마케팅 · 광고 소재 · 이벤트 프로모션을 지원받으세요
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-purple-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 셀러브릭스 플랫폼 */}
      <a href="https://sellerbricks.co.kr" target="_blank" rel="noopener noreferrer" className="block">
        <Card className="border border-border bg-white hover:border-brand-400 hover:shadow-md transition-all">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">셀러브릭스 플랫폼 바로가기</p>
                <p className="text-xs text-muted-foreground mt-1">sellerbricks.co.kr</p>
              </div>
              <ExternalLink className="h-5 w-5 text-brand-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
