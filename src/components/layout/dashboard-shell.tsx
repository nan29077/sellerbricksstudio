"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  LogOut, Menu, X, type LucideIcon,
  LayoutDashboard, CalendarDays, Radio, ShoppingCart, MessageSquare,
  Warehouse, Package, CalendarClock, Users, Building2,
  Settings, ScrollText, Sliders, Image as ImageIcon,
  ChevronRight, Home, Globe, ScanBarcode, TrendingUp, Megaphone,
  Share2, BarChart3, Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProfileImage } from "@/lib/profile";

export type NavItem = { href: string; label: string; icon: LucideIcon; requiresLive?: boolean; requiresFacility?: boolean };
export type NavSection = { title: string; items: NavItem[] };

const ROLE_NAV: Record<string, NavSection[]> = {
  SUPER_ADMIN: [
    { title: "운영 현황", items: [
      { href: "/admin/dashboard", label: "대시보드", icon: LayoutDashboard },
    ]},
    { title: "회원 · 시설", items: [
      { href: "/admin/users",      label: "회원 관리",     icon: Users },
      { href: "/admin/facilities", label: "시설 관리",     icon: Building2 },
    ]},
    { title: "거래 관리", items: [
      { href: "/admin/bookings",         label: "예약 관리",     icon: CalendarDays },
      { href: "/admin/farm-reservations", label: "시설 예약 관리", icon: Building2 },
      { href: "/admin/orders",           label: "주문 관리",   icon: ShoppingCart },
    ]},
    { title: "마케팅", items: [
      { href: "/admin/marketing", label: "마케팅 지원 관리", icon: Megaphone },
    ]},
    { title: "시스템 설정", items: [
      { href: "/admin/site-settings",    label: "사이트 설정", icon: ImageIcon },
      { href: "/admin/site-management",  label: "사이트 관리", icon: Globe },
      { href: "/admin/live-settings",    label: "메뉴 권한 설정", icon: Sliders },
      { href: "/admin/integrations",     label: "연동 설정",   icon: Settings },
      { href: "/admin/audit-logs",       label: "감사 로그",   icon: ScrollText },
    ]},
    { title: "계정", items: [
      { href: "/admin/settings", label: "설정", icon: Settings },
    ]},
  ],
  SELLER: [
    { title: "운영", items: [
      { href: "/seller/dashboard",          label: "대시보드", icon: LayoutDashboard },
      { href: "/seller/bookings",           label: "예약",     icon: CalendarDays, requiresFacility: true },
      { href: "/seller/farm-reservations",  label: "시설 예약", icon: Building2, requiresFacility: true },
    ]},
    { title: "라이브 커머스", items: [
      { href: "/seller/live-sessions", label: "라이브 방송", icon: Radio, requiresLive: true },
    ]},
    { title: "판매", items: [
      { href: "/seller/orders", label: "주문 관리", icon: ShoppingCart, requiresFacility: true },
    ]},
    { title: "마케팅 지원", items: [
      { href: "/seller/marketing",            label: "SNS 마케팅",     icon: Share2 },
      { href: "/seller/marketing/events",     label: "이벤트/프로모션", icon: Megaphone },
      { href: "/seller/marketing/assets",     label: "광고 소재 관리", icon: ImageIcon },
      { href: "/seller/marketing/analytics",  label: "마케팅 분석",    icon: BarChart3 },
      { href: "/seller/marketing/coupons",    label: "쿠폰 관리",      icon: Ticket },
    ]},
    { title: "계정", items: [
      { href: "/seller/settings", label: "설정", icon: Settings },
    ]},
  ],
  FACILITY_ADMIN: [
    { title: "운영", items: [
      { href: "/facility/dashboard", label: "대시보드",  icon: LayoutDashboard },
      { href: "/facility/profile",   label: "시설 정보", icon: Warehouse },
    ]},
    { title: "상품 · 일정", items: [
      { href: "/facility/products", label: "상품 관리", icon: Package },
      { href: "/facility/products/scan", label: "제품관리", icon: ScanBarcode },
      { href: "/facility/schedule", label: "일정 관리", icon: CalendarClock },
    ]},
    { title: "예약 · 라이브", items: [
      { href: "/facility/bookings",      label: "예약 관리", icon: CalendarDays },
      { href: "/facility/live-sessions", label: "라이브",    icon: Radio, requiresLive: true },
      { href: "/facility/orders",        label: "주문 관리", icon: ShoppingCart },
    ]},
    { title: "계정", items: [
      { href: "/facility/settings", label: "설정", icon: Settings },
    ]},
  ],
};

const ROLE_BADGE_COLOR: Record<string, string> = {
  SUPER_ADMIN:    "bg-red-100 text-red-700",
  SELLER:         "bg-brand-100 text-brand-700",
  FACILITY_ADMIN: "bg-blue-100 text-blue-700",
};

export function DashboardShell({
  role,
  roleLabel,
  userName,
  profileImageIndex,
  liveEnabled = true,
  facilityDisabled = false,
  children,
}: {
  role: string;
  roleLabel: string;
  userName: string;
  profileImageIndex?: number | null;
  liveEnabled?: boolean;
  facilityDisabled?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <div className="flex flex-col h-full">
      <Link
        href="/"
        className="flex h-20 items-center gap-2 border-b border-white/10 px-5 shrink-0"
        onClick={onNav}
      >
        <Image
          src="/images/brand/logo-original-on-dark.png"
          alt="셀러브릭스 스튜디오"
          width={150}
          height={40}
          className="h-10 w-auto object-contain"
          priority
        />
      </Link>

      <div className="mx-3 mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src={getProfileImage(profileImageIndex)}
            alt={userName}
            width={36}
            height={36}
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

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
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
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-brand-500 text-navy shadow-[0_8px_20px_rgba(245,166,35,0.2)]"
                      : "text-white/65 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <n.icon className={cn("h-4 w-4 shrink-0", active ? "text-navy" : "text-white/45")} />
                  <span className="flex-1">{n.label}</span>
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
    <div className="min-h-screen bg-[#F7F6F2]">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-navy bg-[#141A2E] shadow-xl z-30">
        <SidebarContent />
      </aside>

      <header className="md:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#ECE8E0] bg-white/95 px-4 shadow-sm backdrop-blur">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/brand/logo-original-on-light.png"
            alt="셀러브릭스 스튜디오"
            width={134}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
        </Link>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", ROLE_BADGE_COLOR[role] ?? "bg-gray-100 text-gray-600")}>
            {roleLabel}
          </span>
          <button className="tap p-2 rounded-lg hover:bg-muted" onClick={() => setOpen(!open)} aria-label="메뉴">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[85vw] bg-[#141A2E] flex flex-col h-full shadow-2xl border-r border-navy">
            <SidebarContent onNav={() => setOpen(false)} />
          </div>
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-8 md:pb-12">
          <div className="mb-7 hidden items-center justify-between border-b border-[#E8E4DB] pb-5 md:flex">
            <div><p className="text-[10px] font-extrabold tracking-[0.2em] text-brand-700">SELLERBRICKS WORKSPACE</p><p className="mt-1 text-sm font-semibold text-slate-500">{roleLabel} <span className="mx-2 text-slate-300">/</span> <span className="text-navy">{currentPage}</span></p></div>
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-brand-700"><Home className="h-4 w-4" />사이트 보기</Link>
          </div>
          {children}
        </div>
      </div>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 grid border-t border-border bg-white safe-area-inset-bottom shadow-lg"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-brand-600" : "text-muted-foreground",
              )}
            >
              <n.icon className={cn("h-5 w-5", active && "text-brand-600")} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
