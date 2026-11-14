"use client";

import Image from "next/image";
import Link from "next/link";
import { useStudioBrand } from "@/components/home/studio-brand";
import { defaultProfileImage } from "@/lib/profile";
import { SupportButton } from "@/components/support/support-center";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useRef } from "react";
import type { Role } from "@prisma/client";
import {
  ArrowUpRight, CircleHelp, Headset, House, LayoutDashboard, LogIn, LogOut,
  Map, Menu, ShoppingBag, UserCircle, Warehouse, X,
} from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SiteLogo } from "@/components/layout/site-logo";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Account = { name: string; role: Role; image: string } | null;

const settingsHref: Record<Role, string> = {
  SUPER_ADMIN: "/admin/settings",
  MANAGER: "/manager/settings",
  BRAND_ADMIN: "/brand/settings",
  FACILITY_ADMIN: "/", // 없어진 역할 (로그인 불가)
  SELLER: "/seller/settings",
  BUYER: "/support#my-inquiries",
};

export function StudioTopBar({ account }: { account: Account }) {
  const menu = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const shopId = /^\/brands\/([^/]+)$/.exec(pathname ?? "")?.[1] ?? null;
  const mark = useStudioBrand();
  const brand = mark && mark.id === shopId ? mark : null;

  return (
    <>
      <header className="sticky top-0 z-40 flex h-[62px] items-center justify-between border-b border-[#E4E8EC] bg-[#F8F9FA]/95 px-4 backdrop-blur-md sm:h-[66px] sm:px-6">
        {shopId ? (
          // 브랜드샵 화면: 스토리지마켓 로고 대신 그 브랜드의 로고 · 이름 (불러오는 동안은 빈 자리)
          <Link href={`/brands/${shopId}`} className="flex min-h-11 min-w-0 items-center gap-2.5" aria-label={brand ? `${brand.name} 브랜드샵 홈` : "브랜드샵 홈"}>
            {brand && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo || defaultProfileImage(`brand:${brand.id}`)} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-white object-cover sm:h-11 sm:w-11" />
                <span className="min-w-0">
                  <span className="block truncate text-base font-black text-navy sm:text-lg">{brand.name}</span>
                  <span className="block text-[10.5px] font-bold tracking-wide text-slate-500">BRAND SHOP · 스토리지마켓</span>
                </span>
              </>
            )}
          </Link>
        ) : (
          <Link href="/" className="flex min-h-11 items-center">
            <SiteLogo className="w-[min(215px,calc(100vw-144px))] sm:w-[250px]" priority />
          </Link>
        )}
        <div className="flex items-center gap-2">
          {account ? <NotificationBell /> : (
            <Link href="/login" aria-label="로그인" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-navy hover:bg-brand-50">
              <UserCircle className="h-5 w-5" />
            </Link>
          )}
          <button type="button" aria-label="메뉴 열기" aria-haspopup="dialog" onClick={() => menu.current?.showModal()} className="grid w-11 place-items-center rounded-full text-navy hover:bg-brand-50 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>
      <dialog ref={menu} aria-labelledby="studio-menu-title" className="fixed inset-y-0 left-auto right-0 m-0 h-full max-h-none w-72 max-w-[88vw] overflow-y-auto rounded-l-[24px] bg-[#F8F9FA] p-4 text-navy shadow-xl backdrop:bg-navy/55 lg:hidden">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 id="studio-menu-title" className="font-extrabold">스토리지마켓 메뉴</h2>
          <button type="button" onClick={() => menu.current?.close()} aria-label="메뉴 닫기" className="grid w-11 place-items-center rounded-xl hover:bg-brand-50"><X className="h-5 w-5" /></button>
        </div>
        <MenuItems account={account} desktop={false} onNavigate={() => menu.current?.close()} />
      </dialog>
      {pathname !== "/support" && (
        <SupportButton showUnread launcher ariaLabel="문의하기" className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-[max(1rem,calc((100vw-716px)/2+1rem))] z-40 grid h-12 w-12 place-items-center rounded-full bg-navy text-white shadow-lg hover:bg-navy-700 lg:hidden">
          <Headset className="h-5 w-5 text-brand-300" />
        </SupportButton>
      )}
      <nav aria-label="모바일 하단 메뉴" className="safe-area-inset-bottom fixed bottom-0 left-1/2 z-40 grid w-full max-w-[716px] -translate-x-1/2 grid-cols-5 border-t border-slate-200 bg-[#F8F9FA]/95 shadow-[0_-6px_24px_#1A1A2E12] backdrop-blur-md lg:hidden">
        {[
          { href: "/", label: "홈", icon: House, active: pathname === "/" },
          { href: "/brands", label: "브랜드샵", icon: ShoppingBag, active: pathname.startsWith("/brands") },
          { href: "/facilities", label: "공간 찾기", icon: Warehouse, active: pathname.startsWith("/facilities") },
          { href: "/support", label: "도움말", icon: CircleHelp, active: pathname.startsWith("/support") },
          { href: account ? settingsHref[account.role] : "/login", label: "마이페이지", icon: UserCircle },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link key={label} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-center text-[11px] font-bold leading-tight text-slate-600 hover:text-navy", active && "text-navy")}>
            <span className={cn("grid h-8 w-8 place-items-center rounded-xl border border-transparent", active && "border-brand-300 bg-brand-100")}>
              {account && Icon === UserCircle
                ? <Image src={account.image} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-full border border-brand-200 object-cover" />
                : <Icon className="h-[17px] w-[17px]" />}
            </span>{label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function StudioNavigation({ account }: { account: Account }) {
  const pathname = usePathname();
  return (
    <>
      <div className="row-start-2 max-h-[calc(100svh-102px)] w-full overflow-y-auto rounded-[24px] border border-white/90 bg-[#F8F9FA]/95 p-2 text-navy shadow-[0_12px_35px_#1A1A2E30] backdrop-blur-md [@media(max-height:740px)]:row-start-1">
        <MenuItems account={account} desktop />
        <p aria-hidden="true" className="pb-1 pt-2 text-center text-[11px] font-black tracking-[0.13em] text-slate-500">STORAGE MARKET</p>
      </div>
      <SupportButton showUnread launcher ariaLabel="문의하기" className="row-start-3 mb-1 flex min-h-11 items-center justify-center gap-1.5 self-end rounded-full border border-white/20 bg-navy px-3 text-[11px] font-bold text-white shadow-lg transition hover:bg-navy-700 [@media(max-height:740px)]:row-start-2">
        <Headset className="h-4 w-4 text-brand-300" />문의하기
      </SupportButton>
    </>
  );
}

function MenuItems({ account, desktop, onNavigate }: { account: Account; desktop: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const home = account && ROLE_HOME[account.role];
  const items = [
    { href: "/", label: "홈", icon: House, active: pathname === "/" },
    { href: "/intro", label: "서비스 소개", icon: Map },
    { href: "/facilities", label: "공간 찾기", icon: Warehouse, active: pathname.startsWith("/facilities") },
    { href: "/brands", label: "브랜드샵", icon: ShoppingBag, active: pathname.startsWith("/brands") },
    ...(home && home !== "/" ? [{ href: home, label: "대시보드", icon: LayoutDashboard }] : []),
    { href: "/support", label: desktop ? "도움말" : "도움말 · 문의하기", icon: CircleHelp, active: pathname === "/support" },
  ];
  const itemStyle = cn(
    "flex min-h-11 w-full items-center rounded-xl border border-transparent text-slate-600 transition hover:bg-brand-50 hover:text-navy",
    desktop ? "flex-col justify-center gap-1 px-1 py-1.5 text-[11px] font-bold" : "gap-3 px-3 py-2 text-sm font-semibold",
  );

  return (
    <nav aria-label="스튜디오 메뉴" className="space-y-1">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(itemStyle, active && "border-brand-200 bg-brand-50 !text-navy")}>
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white", active && "border-brand-300 bg-brand-200")}><Icon className="h-4 w-4" /></span>
          {label}
        </Link>
      ))}
      <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
        {account ? (
          <>
            <Link href={settingsHref[account.role]} aria-label="내 프로필" title={account.name} onClick={onNavigate} className={itemStyle}>
              <Image src={account.image} alt="" width={32} height={32} unoptimized className="h-8 w-8 shrink-0 rounded-full border border-brand-200 bg-white object-cover" />
              <span className={cn("min-w-0", desktop && "w-full text-center")}>
                <span className={cn("block font-extrabold text-navy", desktop ? "line-clamp-2 break-all leading-tight" : "truncate")}>{account.name}</span>
                {/* 이름에 이미 역할명이 들어 있으면(예: "셀러", "테스트셀러") 역할을 한 번만 보여 준다 */}
                {!account.name.replace(/\s/g, "").includes(ROLE_LABELS[account.role].replace(/\s/g, "")) && (
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{ROLE_LABELS[account.role]}</span>
                )}
              </span>
            </Link>
            <button type="button" className={itemStyle} onClick={() => signOut({ callbackUrl: "/" })}><LogOut className="h-4 w-4" />로그아웃</button>
          </>
        ) : (
          <>
            <Link href="/login" onClick={onNavigate} className={itemStyle}><LogIn className="h-4 w-4" />로그인</Link>
            <Link href="/signup" onClick={onNavigate} className={cn(itemStyle, "bg-brand-50 !text-navy")}><ArrowUpRight className="h-4 w-4" />회원가입</Link>
          </>
        )}
      </div>
    </nav>
  );
}
