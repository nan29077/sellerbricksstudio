import type { HomeVideoCategory, HomeVideoItem } from "@/lib/home-videos";

// 메인 외 스튜디오 화면(문의 · 브랜드샵 · 공간 찾기 등)의 PC 왼쪽 영상 플레이어 자리.
// 플레이어 본체는 PC 작업본(studio-broadcast-rail.local.tsx)에 있다 — tsconfig의 "@studio-rail"이
// 그 파일이 있으면 그것을, 없으면 이 빈 기본값을 쓴다. (2026-11-14)
//  videos: 이 화면 전용 영상(예: 브랜드샵의 라이브 커머스 영상). 없으면 메인 영상.
export function StudioBroadcastRail(props: { videos?: Record<HomeVideoCategory, HomeVideoItem[]> | null; title?: string }) {
  void props;
  return null;
}
