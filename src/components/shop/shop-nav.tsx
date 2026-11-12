"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ShopNavItem = { href: string; label: string; icon: React.ReactNode };

// 샵 오른쪽(모바일은 하단) 메뉴. "#섹션" 링크는 해당 섹션으로 직접 스크롤하고, 지금 보고 있는 섹션을 표시한다.
export function ShopNav({ items }: { items: ShopNavItem[] }) {
  const [active, setActive] = useState(items[0]?.href ?? "");

  useEffect(() => {
    const targets = items
      .filter((item) => item.href.startsWith("#"))
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;
    const onScroll = () => {
      // 화면 위쪽 1/3 지점을 지난 마지막 섹션을 현재 위치로 본다
      const line = window.innerHeight / 3;
      let current = targets[0];
      for (const el of targets) if (el.getBoundingClientRect().top <= line) current = el;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = targets[targets.length - 1];
      setActive(`#${current.id}`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [items]);

  const go = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const el = document.getElementById(href.slice(1));
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `${location.pathname}${location.search}${href}`);
    setActive(href);
  };

  const itemClass = (on: boolean) => cn(
    "flex min-h-[50px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[10.5px] font-semibold leading-tight transition-colors focus-visible:outline-brand-500",
    on ? "bg-brand-50 text-navy" : "text-slate-500 hover:bg-slate-50 hover:text-navy",
  );

  return (
    <nav aria-label="샵 메뉴"
      className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-[716px] -translate-x-1/2 justify-around gap-0.5 border-t border-slate-200/80 bg-white/95 px-1 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] backdrop-blur lg:bottom-auto lg:left-[calc(50%+368px)] lg:top-1/2 lg:w-[76px] lg:translate-x-0 lg:-translate-y-1/2 lg:flex-col lg:gap-1 lg:rounded-2xl lg:border lg:border-slate-200/80 lg:p-1.5 lg:shadow-[0_4px_20px_#1A1A2E14]">
      {items.map(({ href, label, icon }) => href.startsWith("#") ? (
        <a key={href} href={href} onClick={(e) => go(e, href)} aria-current={active === href ? "location" : undefined} className={itemClass(active === href)}>
          {icon}{label}
        </a>
      ) : (
        <Link key={href} href={href} className={itemClass(false)}>{icon}{label}</Link>
      ))}
    </nav>
  );
}
