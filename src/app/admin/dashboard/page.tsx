import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatKRW } from "@/lib/utils";
import {
  ArrowRight, ArrowUpRight, Building2, CalendarDays,
  CheckCircle2, ChevronRight, CircleAlert, ClipboardList,
  Globe, Settings2, Users, Radio, Wallet, TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

type RecentUser = {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  profile: { name: string | null } | null;
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "관리자",
  FACILITY_ADMIN: "시설 운영자",
  SELLER: "셀러",
  MANAGER: "매니저",
};

const roleTones: Record<string, string> = {
  SUPER_ADMIN: "bg-rose-50 text-rose-700",
  FACILITY_ADMIN: "bg-sky-50 text-sky-700",
  SELLER: "bg-amber-50 text-amber-700",
  MANAGER: "bg-violet-50 text-violet-700",
};

async function getDashboardData() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      userCounts,
      facilityCounts,
      bookingCounts,
      recentUsers,
      liveSessions,
      pendingSettlements,
      thisMonthRevenue,
      lastMonthRevenue,
      totalOrderCount,
      pendingOrders,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.facility.groupBy({ by: ["status"], _count: true }),
      prisma.booking.groupBy({ by: ["status"], _count: true }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true, email: true, role: true, createdAt: true,
          profile: { select: { name: true } },
        },
      }),
      // 라이브 세션 상태별
      prisma.liveSession.groupBy({ by: ["status"], _count: true }),
      // 정산 대기 건수
      prisma.settlement.count({ where: { status: "PENDING" } }),
      // 이번 달 매출
      prisma.order.aggregate({
        where: {
          status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      // 지난달 매출 (증감 비교)
      prisma.order.aggregate({
        where: {
          status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
          createdAt: { gte: lastMonthStart, lt: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      // 전체 주문 수
      prisma.order.count({
        where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } },
      }),
      // 처리 대기 주문
      prisma.order.count({ where: { status: "PAID" } }),
    ]);

    const thisRevenue = thisMonthRevenue._sum.totalAmount ?? 0;
    const lastRevenue = lastMonthRevenue._sum.totalAmount ?? 0;
    const revenueDiff = lastRevenue > 0 ? Math.round(((thisRevenue - lastRevenue) / lastRevenue) * 100) : null;

    const liveCount = (status: string) =>
      liveSessions.find((l) => l.status === status)?._count ?? 0;

    return {
      userCounts,
      facilityCounts,
      bookingCounts,
      recentUsers: recentUsers as RecentUser[],
      activeLives: liveCount("LIVE"),
      totalLives: liveSessions.reduce((s, l) => s + l._count, 0),
      pendingSettlements,
      thisMonthRevenue: thisRevenue,
      revenueDiff,
      totalOrders: totalOrderCount,
      pendingOrders,
    };
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  await requireRole(["SUPER_ADMIN"]);
  const data = await getDashboardData();

  const count = (
    items: { _count: number; role?: string; status?: string }[] | undefined,
    key: string,
  ) => items?.find((item) => item.role === key || item.status === key)?._count ?? 0;

  const totalUsers = data?.userCounts.reduce((sum, item) => sum + item._count, 0) ?? 0;
  const totalFacilities = data?.facilityCounts.reduce((sum, item) => sum + item._count, 0) ?? 0;
  const totalBookings = data?.bookingCounts.reduce((sum, item) => sum + item._count, 0) ?? 0;
  const pendingFacilities = count(data?.facilityCounts, "PENDING");
  const pendingBookings = count(data?.bookingCounts, "PENDING");
  const sellers = count(data?.userCounts, "SELLER");
  const facilityAdmins = count(data?.userCounts, "FACILITY_ADMIN");
  const managers = count(data?.userCounts, "MANAGER");

  const activeLives = data?.activeLives ?? 0;
  const totalLives = data?.totalLives ?? 0;
  const pendingSettlements = data?.pendingSettlements ?? 0;
  const thisMonthRevenue = data?.thisMonthRevenue ?? 0;
  const revenueDiff = data?.revenueDiff;
  const totalOrders = data?.totalOrders ?? 0;
  const pendingOrders = data?.pendingOrders ?? 0;

  const revenueLabel =
    revenueDiff !== null && revenueDiff !== undefined
      ? revenueDiff > 0
        ? `전월 대비 +${revenueDiff}%`
        : revenueDiff < 0
          ? `전월 대비 ${revenueDiff}%`
          : "전월 동일"
      : "전월 데이터 없음";

  const overview = [
    {
      label: "전체 회원",
      value: totalUsers,
      unit: "명",
      detail: `셀러 ${sellers}명`,
      icon: Users,
      tone: "bg-amber-50 text-amber-700",
      href: "/admin/users",
    },
    {
      label: "등록 시설",
      value: totalFacilities,
      unit: "개",
      detail: `승인 대기 ${pendingFacilities}개`,
      icon: Building2,
      tone: "bg-sky-50 text-sky-700",
      href: "/admin/facilities",
    },
    {
      label: "전체 예약",
      value: totalBookings,
      unit: "건",
      detail: `처리 대기 ${pendingBookings}건`,
      icon: CalendarDays,
      tone: "bg-violet-50 text-violet-700",
      href: "/admin/bookings",
    },
    {
      label: "전체 주문",
      value: totalOrders,
      unit: "건",
      detail: `결제 처리 대기 ${pendingOrders}건`,
      icon: TrendingUp,
      tone: "bg-emerald-50 text-emerald-700",
      href: "/admin/orders",
    },
  ];

  const quickActions = [
    { title: "회원 관리",    description: "가입 회원과 역할 확인",    href: "/admin/users",          icon: Users },
    { title: "시설 승인",    description: "등록 시설 검토 및 관리",   href: "/admin/facilities",     icon: Building2 },
    { title: "예약 관리",    description: "예약 요청과 상태 확인",    href: "/admin/bookings",       icon: ClipboardList },
    { title: "정산 관리",    description: "정산 대기 항목 처리",      href: "/admin/settlements",    icon: Wallet },
    { title: "라이브 세션",  description: "라이브 현황 모니터링",     href: "/admin/live-sessions",  icon: Radio },
    { title: "사이트 설정",  description: "배너와 기본 정보 관리",    href: "/admin/site-settings",  icon: Settings2 },
  ];

  const roleBreakdown = [
    { label: "셀러",       value: sellers,       color: "bg-brand-500" },
    { label: "시설 운영자", value: facilityAdmins, color: "bg-sky-500" },
    { label: "매니저",     value: managers,       color: "bg-violet-500" },
  ];

  return (
    <div className="space-y-8 pb-6">
      {/* 히어로 배너 */}
      <section className="relative isolate overflow-hidden rounded-[28px] bg-navy px-7 py-10 text-white sm:px-10 sm:py-12">
        <Image
          src="/images/home/hero-studio.webp"
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 80vw"
          className="object-cover object-[70%_center] opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/95 to-navy/20" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-widest text-brand-200">
            <span className={`h-2 w-2 rounded-full ${data ? "bg-emerald-400" : "bg-amber-400"}`} />
            OPERATIONS OVERVIEW
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            운영의 흐름을 한눈에.
          </h1>
          <p className="mt-3 text-sm leading-7 text-white/75 sm:text-base">
            회원, 시설, 예약, 주문, 정산 현황을 살펴보고 지금 필요한 운영 작업으로 바로 이동하세요.
          </p>
          <div className="mt-7 flex flex-wrap gap-2 text-xs font-semibold text-white/85">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
              {data ? "실제 데이터 기준" : "데이터 연결 확인 필요"}
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
              최고관리자 워크스페이스
            </span>
            {activeLives > 0 && (
              <span className="rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1.5 text-red-200">
                라이브 방송 {activeLives}개 진행 중
              </span>
            )}
          </div>
        </div>
        <Link
          href="/"
          className="relative mt-8 inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-brand-200 hover:text-white sm:absolute sm:bottom-10 sm:right-10 sm:mt-0"
        >
          사이트 보기
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </section>

      {/* DB 연결 오류 배너 */}
      {!data && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900" role="status">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">운영 데이터를 불러올 수 없습니다</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              데이터베이스 연결을 확인해 주세요. 아래 수치는 연결 후 표시됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 이번 달 매출 + 라이브 + 정산 요약 */}
      {data && (
        <section>
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-700 mb-3">THIS MONTH</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-[#E9E5DC] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-500">이번 달 매출</p>
              </div>
              <p className="text-2xl font-extrabold text-navy">
                {thisMonthRevenue > 0 ? formatKRW(thisMonthRevenue) : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">{revenueLabel}</p>
            </div>
            <div className="rounded-[22px] border border-[#E9E5DC] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="h-5 w-5 text-purple-600" />
                <p className="text-sm font-semibold text-slate-500">라이브 세션</p>
              </div>
              <p className="text-2xl font-extrabold text-navy">{totalLives}<span className="ml-1 text-base font-semibold text-slate-500">개</span></p>
              <p className="text-xs text-slate-500 mt-1">
                {activeLives > 0 ? (
                  <span className="text-red-600 font-bold">현재 {activeLives}개 방송 중</span>
                ) : "현재 방송 없음"}
              </p>
            </div>
            <Link href="/admin/settlements">
              <div className={`rounded-[22px] border p-5 shadow-sm hover:shadow-md transition cursor-pointer ${pendingSettlements > 0 ? "border-amber-300 bg-amber-50" : "border-[#E9E5DC] bg-white"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className={`h-5 w-5 ${pendingSettlements > 0 ? "text-amber-600" : "text-slate-500"}`} />
                  <p className="text-sm font-semibold text-slate-500">정산 대기</p>
                </div>
                <p className={`text-2xl font-extrabold ${pendingSettlements > 0 ? "text-amber-700" : "text-navy"}`}>
                  {pendingSettlements}<span className="ml-1 text-base font-semibold text-slate-500">건</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {pendingSettlements > 0 ? "승인 처리 필요" : "대기 항목 없음"}
                </p>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* 플랫폼 현황 (4개 카드) */}
      <section aria-labelledby="overview-heading">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-700">AT A GLANCE</p>
            <h2 id="overview-heading" className="mt-1 text-xl font-extrabold text-navy sm:text-2xl">
              플랫폼 현황
            </h2>
          </div>
          <span className="text-xs text-slate-500">현재 집계</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overview.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group rounded-[22px] border border-[#E9E5DC] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                  <item.icon className="h-6 w-6" />
                </span>
                <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-brand-700" />
              </div>
              <p className="mt-6 text-sm font-semibold text-slate-500">{item.label}</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-navy">
                {data ? item.value.toLocaleString("ko-KR") : "—"}
                <span className="ml-1 text-base font-semibold text-slate-500">
                  {data ? item.unit : ""}
                </span>
              </p>
              <p className="mt-3 text-xs font-medium text-slate-500">
                {data ? item.detail : "데이터를 기다리고 있습니다"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* 확인이 필요한 작업 */}
        <section
          className="rounded-[24px] border border-[#E9E5DC] bg-white p-6 shadow-sm sm:p-7"
          aria-labelledby="attention-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-700">TO DO TODAY</p>
              <h2 id="attention-heading" className="mt-1 text-xl font-extrabold text-navy">
                확인이 필요한 작업
              </h2>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6 space-y-3">
            <Link
              href="/admin/facilities"
              className="flex items-center justify-between gap-3 rounded-2xl bg-[#F9F7F2] p-4 transition hover:bg-brand-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-700">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-navy">시설 승인 대기</p>
                  <p className="text-xs text-slate-500">새로 등록된 시설을 검토하세요</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-sm font-extrabold text-brand-700">
                {data ? `${pendingFacilities}건` : "—"}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href="/admin/bookings"
              className="flex items-center justify-between gap-3 rounded-2xl bg-[#F9F7F2] p-4 transition hover:bg-brand-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sky-700">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-navy">예약 요청 대기</p>
                  <p className="text-xs text-slate-500">진행 중인 요청을 확인하세요</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-sm font-extrabold text-brand-700">
                {data ? `${pendingBookings}건` : "—"}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href="/admin/settlements"
              className="flex items-center justify-between gap-3 rounded-2xl bg-[#F9F7F2] p-4 transition hover:bg-brand-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-navy">정산 승인 대기</p>
                  <p className="text-xs text-slate-500">정산 요청을 확인하고 승인하세요</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-sm font-extrabold text-brand-700">
                {data ? `${pendingSettlements}건` : "—"}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
            {data && pendingFacilities === 0 && pendingBookings === 0 && pendingSettlements === 0 && (
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                현재 대기 중인 항목이 없습니다.
              </p>
            )}
          </div>
        </section>

        {/* 회원 구성 */}
        <section
          className="rounded-[24px] border border-[#E9E5DC] bg-white p-6 shadow-sm sm:p-7"
          aria-labelledby="roles-heading"
        >
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-700">MEMBER MIX</p>
            <h2 id="roles-heading" className="mt-1 text-xl font-extrabold text-navy">
              회원 구성
            </h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">역할별 등록 회원 현황</p>
          <div className="mt-7 space-y-6">
            {roleBreakdown.map((role) => (
              <div key={role.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-navy">{role.label}</span>
                  <span className="font-bold text-navy">{data ? `${role.value}명` : "—"}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#F1EEE8]">
                  <div
                    className={`h-full rounded-full ${role.color}`}
                    style={{
                      width:
                        data && totalUsers
                          ? `${Math.max((role.value / totalUsers) * 100, role.value ? 3 : 0)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/admin/users"
            className="mt-8 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-navy"
          >
            회원 관리로 이동
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* 최근 가입 회원 */}
        <section
          className="rounded-[24px] border border-[#E9E5DC] bg-white p-6 shadow-sm sm:p-7"
          aria-labelledby="recent-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-700">NEW MEMBERS</p>
              <h2 id="recent-heading" className="mt-1 text-xl font-extrabold text-navy">
                최근 가입 회원
              </h2>
            </div>
            <Link href="/admin/users" className="text-xs font-bold text-brand-700 hover:text-navy">
              전체 보기
            </Link>
          </div>
          {data?.recentUsers.length ? (
            <div className="mt-5 divide-y divide-[#F0ECE6]">
              {data.recentUsers.map((user) => {
                const name = user.profile?.name || user.email.split("@")[0];
                return (
                  <div key={user.id} className="flex items-center gap-3 py-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">
                      {name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy">{name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${roleTones[user.role] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {roleLabels[user.role] ?? user.role}
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Intl.DateTimeFormat("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        }).format(user.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-[#F9F7F2] p-8 text-center text-sm text-slate-500">
              {data
                ? "최근 가입한 회원이 없습니다."
                : "데이터 연결 후 최근 가입 회원이 표시됩니다."}
            </div>
          )}
        </section>

        {/* 빠른 이동 */}
        <section
          className="rounded-[24px] border border-[#E9E5DC] bg-white p-6 shadow-sm sm:p-7"
          aria-labelledby="quick-heading"
        >
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-700">SHORTCUTS</p>
            <h2 id="quick-heading" className="mt-1 text-xl font-extrabold text-navy">
              빠른 이동
            </h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-2xl border border-[#EEEAE2] p-3.5 transition hover:border-brand-300 hover:bg-brand-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F2E9] text-brand-700">
                  <action.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-navy">{action.title}</span>
                  <span className="block text-xs text-slate-500">{action.description}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-brand-700" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* 사이트 관리 바로가기 */}
      <Link
        href="/admin/site-management"
        className="group flex items-center justify-between gap-4 rounded-[22px] bg-navy p-6 text-white transition hover:bg-navy-700 sm:p-7"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-300">
            <Globe className="h-6 w-6" />
          </span>
          <div>
            <p className="font-bold">사이트 화면도 함께 관리하세요</p>
            <p className="mt-1 text-sm text-white/60">
              공개 페이지의 주요 설정과 콘텐츠를 확인할 수 있습니다.
            </p>
          </div>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-brand-300" />
      </Link>
    </div>
  );
}
