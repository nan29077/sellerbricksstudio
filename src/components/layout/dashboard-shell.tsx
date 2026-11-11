"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  LogOut, Menu, X, type LucideIcon,
  LayoutDashboard, CalendarDays, MessageSquare,
  Warehouse, CalendarClock, Users, Building2, SquarePlus,
  Settings, ScrollText, Sliders, Image as ImageIcon,
  ChevronRight, Home, Globe, TrendingUp, Megaphone,
  Share2, BarChart3, Ticket, LayoutTemplate, Star, Wallet, Coins, Package,
} from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: LucideIcon; requiresLive?: boolean; requiresFacility?: boolean };
export type NavSection = { title: string; items: NavItem[] };

const ROLE_NAV: Record<string, NavSection[]> = {
  SUPER_ADMIN: [
    { title: "운영 현황", items: [
      { href: "/admin/dashboard", label: "대시보드", icon: LayoutDashboard },
    ]},
    { title: "회원 · 창고(스튜디오)", items: [
      { href: "/admin/users",      label: "회원 관리", icon: Users },
      { href: "/admin/facilities", label: "창고(스튜디오) 관리", icon: Building2 },
      { href: "/admin/managers",   label: "매니저 관리", icon: Users },
      { href: "/admin/reviews",    label: "리뷰 관리", icon: Star },
    ]},
    { title: "예약 관리", items: [
      { href: "/admin/bookings",          label: "예약 현황", icon: CalendarDays },
      { href: "/admin/farm-reservations", label: "창고(스튜디오) 예약", icon: Building2 },
    ]},
    { title: "정산 · 마케팅", items: [
      { href: "/admin/settlements", label: "정산 관리",    icon: TrendingUp },
      { href: "/admin/marketing",   label: "마케팅 지원",  icon: Megaphone },
    ]},
    { title: "시스템 설정", items: [
      { href: "/admin/support",         label: "고객 문의 관리", icon: MessageSquare },
      { href: "/admin/home-background", label: "메인 여백 관리", icon: ImageIcon },
      { href: "/admin/site-settings",   label: "사이트 설정",    icon: ImageIcon },
      { href: "/admin/site-management", label: "사이트 관리",    icon: Globe },
      { href: "/admin/live-settings",   label: "메뉴 권한 설정", icon: Sliders },
      { href: "/admin/integrations",    label: "연동 설정",      icon: Settings },
      { href: "/admin/audit-logs",      label: "감사 로그",      icon: ScrollText },
    ]},
    { title: "계정", items: [
      { href: "/admin/settings", label: "설정", icon: Settings },
    ]},
  ],
  SELLER: [
    { title: "운영", items: [
      { href: "/seller/dashboard", label: "대시보드", icon: LayoutDashboard },
      { href: "/seller/bookings",  label: "예약 관리", icon: CalendarDays, requiresFacility: true },
    ]},
    { title: "창고·스튜디오", items: [
      { href: "/seller/products",           label: "판매 상품 둘러보기", icon: Package, requiresFacility: true },
      { href: "/facilities",                label: "창고(스튜디오) 검색", icon: Warehouse },
      { href: "/seller/farm-reservations",  label: "창고(스튜디오) 예약 현황",      icon: Building2, requiresFacility: true },
    ]},
    { title: "마케팅 지원", items: [
      { href: "/seller/marketing",           label: "SNS 마케팅",     icon: Share2 },
      { href: "/seller/marketing/events",    label: "이벤트/프로모션", icon: Megaphone },
      { href: "/seller/marketing/assets",    label: "광고 소재",      icon: ImageIcon },
      { href: "/seller/marketing/analytics", label: "마케팅 분석",    icon: BarChart3 },
      { href: "/seller/marketing/coupons",   label: "쿠폰 관리",     icon: Ticket },
    ]},
    { title: "정산", items: [
      { href: "/seller/settlements", label: "정산 내역", icon: TrendingUp },
    ]},
    { title: "계정", items: [
      { href: "/seller/settings", label: "설정", icon: Settings },
    ]},
  ],
  FACILITY_ADMIN: [
    { title: "운영", items: [
      { href: "/facility/dashboard", label: "대시보드",  icon: LayoutDashboard },
      { href: "/facility/profile",   label: "창고(스튜디오) 정보 · 편집", icon: Warehouse },
      { href: "/facility/register",  label: "창고(스튜디오) 등록", icon: SquarePlus },
      { href: "/facility/pages",     label: "창고(스튜디오) 페이지 꾸미기", icon: LayoutTemplate },
      { href: "/facility/products",  label: "상품 관리", icon: Package },
    ]},
    { title: "예약 관리", items: [
      { href: "/facility/bookings",   label: "예약 현황", icon: CalendarDays },
      { href: "/facility/schedule",   label: "일정 관리", icon: CalendarClock },
      { href: "/facility/inquiries",  label: "셀러 문의", icon: MessageSquare },
      { href: "/facility/reviews",    label: "리뷰 관리", icon: Star },
    ]},
    { title: "창고(스튜디오) 운영", items: [
      { href: "/facility/settlements", label: "정산 내역", icon: TrendingUp },
      { href: "/facility/settings",    label: "설정",      icon: Settings },
    ]},
  ],
};

ROLE_NAV.MANAGER = [
  { title: "영업 현황", items: [
    { href: "/manager/dashboard",  label: "대시보드", icon: LayoutDashboard },
    { href: "/manager/facilities", label: "담당 창고(스튜디오)", icon: Building2 },
    { href: "/manager/bookings",   label: "예약 현황", icon: CalendarDays },
  ]},
  { title: "매출 · 수수료", items: [
    { href: "/manager/sales",       label: "매출 현황", icon: Wallet },
    { href: "/manager/commissions", label: "내 수수료", icon: Coins },
  ]},
  { title: "계정", items: [
    { href: "/manager/settings", label: "설정", icon: Settings },
  ]},
];

const ROLE_BADGE_COLOR: Record<string, string> = {
  SUPER_ADMIN:    "bg-red-100 text-red-700",
  SELLER:         "bg-brand-100 text-brand-700",
  FACILITY_ADMIN: "bg-blue-100 text-blue-700",
  MANAGER:        "bg-purple-100 text-purple-700",
};

export function DashboardShell({
  role,
  roleLabel,
  userName,
  avatarSrc,
  liveEnabled = true,
  facilityDisabled = false,
  children,
}: {
  role: string;
  roleLabel: string;
  userName: string;
  avatarSrc: string;
  liveEnabled?: boolean;
  facilityDisabled?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) menu.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);

  const sections: NavSection[] = (ROLE_NAV[role] ?? [])
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => (liveEnabled || !it.requiresLive) && (!facilityDisabled || !it.requiresFacility)),
    }))
    .filter((s) => s.items.length > 0);
  const navItems = sections.flatMap((s) => s.items);
  const tabs = navItems.slice(0, 5);
  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    // 더 구체적으로 일치하는 다른 메뉴가 있으면 상위 메뉴는 비활성 처리
    return !navItems.some(
      (o) => o.href !== href && o.href.length > href.length && (pathname === o.href || pathname.startsWith(o.href + "/")),
    );
  };
  const currentPage = navItems.find((item) => isActive(item.href))?.label ?? "워크스페이스";

  const renderSidebar = (onNav?: () => void) => (
    <div className="flex h-full min-h-0 flex-col">
      <Link
        href="/"
        className="flex h-[68px] shrink-0 items-center border-b border-white/10 px-5"
        onClick={onNav}
      >
        <Image
          src="/images/brand/logo-original-on-dark.png?v=8"
          alt="셀러브릭스 스튜디오"
          width={168}
          height={30}
          className={cn("h-[30px] w-auto object-contain", onNav && "max-w-[150px]")}
          priority
        />
      </Link>

      <div className="mx-3 mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src={avatarSrc}
            alt={userName}
            width={36}
            height={36}
            unoptimized
            className="h-10 w-10 rounded-full object-cover shrink-0 border border-white/20 bg-white"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{userName}</p>
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", ROLE_BADGE_COLOR[role] ?? "bg-gray-100 text-gray-600")}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      <nav aria-label="업무 메뉴" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
        {sections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              {section.title}
            </p>
            {section.items.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={onNav}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-brand-500 text-navy shadow-[0_8px_20px_rgba(245,166,35,0.2)]"
                      : "text-white/65 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <n.icon className={cn("h-4 w-4 shrink-0", active ? "text-navy" : "text-white/45")} />
                  <span className="min-w-0 flex-1 break-keep">{n.label}</span>
                  {active && <ChevronRight className="h-3 w-3 opacity-60" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 shrink-0 space-y-1">
        <Link
          href="/"
          onClick={onNav}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-300 transition-colors hover:bg-white/10"
        >
          <Home className="h-4 w-4 shrink-0" />
          메인으로
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/55 hover:bg-red-400/10 hover:text-red-200 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-svh bg-[#F7F6F2] lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh self-start border-r border-navy bg-[#141A2E] lg:block">
        {renderSidebar()}
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-[#ECE8E0] bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/brand/logo-original-on-light.png?v=8"
            alt="셀러브릭스 스튜디오"
            width={146}
            height={26}
            className="h-[23px] w-auto object-contain sm:h-[26px]"
            priority
          />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <span className={cn("hidden rounded-full px-2 py-0.5 text-xs font-semibold min-[420px]:inline-flex", ROLE_BADGE_COLOR[role] ?? "bg-gray-100 text-gray-600")}>
            {roleLabel}
          </span>
          <button type="button" className="tap rounded-lg p-2 hover:bg-muted" onClick={() => { menu.current?.showModal(); setOpen(true); }} aria-controls="dashboard-menu" aria-haspopup="dialog" aria-expanded={open} aria-label="메뉴 열기">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <dialog
        ref={menu}
        id="dashboard-menu"
        aria-label="업무 메뉴"
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) menu.current?.close(); }}
        className="fixed inset-y-0 left-0 right-auto m-0 h-full max-h-none w-72 max-w-[85vw] overflow-hidden border-r border-navy bg-[#141A2E] text-white shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm lg:hidden"
      >
        <div className="relative h-full">
          <button type="button" aria-label="메뉴 닫기" onClick={() => menu.current?.close()} className="absolute right-3 top-3 z-10 grid w-11 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
          {renderSidebar(() => menu.current?.close())}
        </div>
      </dialog>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 hidden h-[68px] items-center justify-between gap-4 border-b border-[#E8E4DB] bg-white/95 px-7 backdrop-blur lg:flex 2xl:px-9">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-brand-800">SELLERBRICKS WORKSPACE</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-600">{roleLabel} <span className="mx-2 text-slate-400">/</span> <span className="text-navy">{currentPage}</span></p>
          </div>
          <div className="flex shrink-0 items-center gap-3"><NotificationBell /><Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-bold text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"><Home className="h-4 w-4" />사이트 보기</Link></div>
        </header>
        <main className="min-w-0 px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 sm:pt-6 lg:px-7 lg:pb-10 2xl:px-9">
          {children}
        </main>
      </div>

      <nav
        aria-label="모바일 업무 메뉴"
        className="safe-area-inset-bottom fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-white shadow-lg lg:hidden"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5 text-center text-[10px] font-medium leading-tight transition-colors",
                active ? "text-brand-600" : "text-muted-foreground",
              )}
            >
              <n.icon className={cn("h-5 w-5", active && "text-brand-600")} />
              <span className="line-clamp-2 break-keep">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
