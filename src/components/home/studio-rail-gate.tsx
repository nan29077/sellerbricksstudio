"use client";

import { usePathname } from "next/navigation";

// 공용 레일 플레이어를 보여 줄 화면인지.
//  - 메인(/)은 화면 안에 플레이어가 따로 있다.
//  - 브랜드샵(/brands/샵)은 그 브랜드의 라이브 커머스 영상으로 화면이 직접 띄운다.
export const OWN_PLAYER_PATH = /^\/brands\/[^/]+$/;
export function StudioRailGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!pathname || pathname === "/" || OWN_PLAYER_PATH.test(pathname)) return null;
  return <>{children}</>;
}
