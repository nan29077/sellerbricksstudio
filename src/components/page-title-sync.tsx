"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site-brand";

// 브라우저 탭 제목: 페이지가 따로 제목을 정하지 않았으면(사이트 기본 제목이면) 화면의 큰 제목(h1)으로 채운다.
// 예) "주문 현황 | 스토리지마켓". 탭 여러 개를 열어도 구분되고, 방문 기록에서도 찾기 쉽다.

export function PageTitleSync({ defaultTitle }: { defaultTitle: string }) {
  const pathname = usePathname();
  const lastAuto = useRef<string | null>(null);
  useEffect(() => {
    if (pathname === "/") return;
    const apply = () => {
      const cur = document.title;
      if (cur !== defaultTitle && cur !== lastAuto.current) return; // 페이지가 직접 정한 제목은 그대로
      const h = document.querySelector("main h1, h1");
      const text = h?.textContent?.replace(/\s+/g, " ").trim().slice(0, 60);
      if (!text) return;
      const next = `${text} | ${SITE_NAME}`;
      lastAuto.current = next;
      if (cur !== next) document.title = next;
    };
    const timers = [50, 400, 1500].map((ms) => setTimeout(apply, ms));
    return () => timers.forEach(clearTimeout);
  }, [pathname, defaultTitle]);
  return null;
}
