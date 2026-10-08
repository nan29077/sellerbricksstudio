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

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <div className="flex flex-col h-full">
      <Link
        href="/"
        className="flex h-16 items-center gap-2 border-b border-border px-5 bg-white shrink-0"
        onClick={onNav}
      >
        <Image
          src="/images/bee/studio-logo-headset.png"
          alt="셀러브릭스 스튜디오"
          width={160}
          height={36}
          className="h-8 w-auto object-contain"
          priority
        />
      </Link>

      <div className="px-4 py-3 border-b border-border bg-brand-50 shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src={getProfileImage(profileImageIndex)}
            alt={userName}
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover shrink-0 border border-brand-200 bg-white"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-navy truncate">{userName}</p>
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", ROLE_BADGE_COLOR[role] ?? "bg-gray-100 text-gray-600")}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 bg-white">
        {sections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
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
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-navy/80 hover:bg-brand-50 hover:text-brand-700",
                  )}
                >
                  <n.icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-muted-foreground")} />
                  <span className="flex-1">{n.label}</span>
                  {active && <ChevronRight className="h-3 w-3 opacity-60" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3 bg-white shrink-0 space-y-1">
        <Link
          href="/"
          onClick={onNav}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          style={{ color: "#F5A623" }}
        >
          <Home className="h-4 w-4 shrink-0" style={{ color: "#F5A623" }} />
          메인으로
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy/70 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-50/40">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-white shadow-sm z-30">
        <SidebarContent />
      </aside>

      <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4 shadow-sm">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/bee/studio-logo-headset.png"
            alt="셀러브릭스 스튜디오"
            width={140}
            height={32}
            className="h-7 w-auto object-contain"
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
          <div className="w-72 max-w-[85vw] bg-white flex flex-col h-full shadow-2xl border-r border-border">
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
        <div className="container max-w-6xl py-6 pb-24 md:pb-10">{children}</div>
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
