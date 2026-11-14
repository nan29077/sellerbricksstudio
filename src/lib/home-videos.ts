import type { HomeVideo } from "@prisma/client";
import { prisma } from "./prisma";
import { safeHttpUrl } from "./stream-embed";

// ---------------------------------------------------------------------------
// 메인 영상 플레이어 (2026-11-14)
//  '라이브 커머스' 한 탭 — 지난 라이브 커머스 · 숏폼 · 홍보 · 캠페인 · 행사 영상
//  최고관리자가 사이트 관리 → 홈 영상에서 링크를 넣는다. 넣은 링크를 메인 플레이어에서 바로 재생한다.
//   - 유튜브(일반 · 쇼츠 · 라이브 다시보기) · 비메오 → 끼워 넣기 플레이어
//   - mp4 · webm · mov 등 영상 파일 주소 → 브라우저 기본 플레이어
//   - 그 밖의 주소(인스타그램 · 틱톡 · 네이버 등) → 끼워 넣을 수 없어 '원본에서 보기'로 연다
// ---------------------------------------------------------------------------

export { HOME_VIDEO_CATEGORIES, isHomeVideoCategory, videoSourceOf, VIDEO_KIND_LABEL } from "./home-video-source";
export type { HomeVideoCategory, VideoSource } from "./home-video-source";
import { isHomeVideoCategory, videoSourceOf, type HomeVideoCategory, type VideoSource } from "./home-video-source";

/** 메인 플레이어가 쓰는 영상 한 개 */
export type HomeVideoItem = {
  id: string; category: HomeVideoCategory; title: string; caption: string; url: string;
  poster: string | null; duration: string; source: VideoSource;
};

export function toHomeVideoItem(v: Pick<HomeVideo, "id" | "category" | "title" | "caption" | "url" | "thumbnailUrl" | "duration">): HomeVideoItem | null {
  const source = videoSourceOf(v.url);
  if (!source || !isHomeVideoCategory(v.category)) return null;
  const thumb = safeHttpUrl(v.thumbnailUrl) ?? (v.thumbnailUrl?.startsWith("/") && !v.thumbnailUrl.startsWith("//") ? v.thumbnailUrl : null);
  return {
    id: v.id, category: v.category, title: v.title, caption: v.caption, url: v.url, duration: v.duration,
    poster: thumb ?? (source.kind === "youtube" ? `https://i.ytimg.com/vi/${source.id}/hqdefault.jpg` : null),
    source,
  };
}

/** 지금 보여 줄 영상인지 (숨김 · 노출 기간) */
export function isVideoShown(v: Pick<HomeVideo, "isVisible" | "startsAt" | "endsAt">, now = new Date()) {
  return v.isVisible && (!v.startsAt || v.startsAt <= now) && (!v.endsAt || v.endsAt > now);
}

/** 메인 플레이어용 영상 목록 (탭별) */
export async function getHomeVideos(): Promise<Record<HomeVideoCategory, HomeVideoItem[]>> {
  const now = new Date();
  const rows = await prisma.homeVideo.findMany({
    where: { isVisible: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  const out: Record<HomeVideoCategory, HomeVideoItem[]> = { LIVE_COMMERCE: [] };
  for (const r of rows) { const item = toHomeVideoItem({ ...r, category: "LIVE_COMMERCE" }); if (item) out.LIVE_COMMERCE.push(item); }
  return out;
}

/** 브랜드샵 화면 왼쪽 플레이어용 — 그 브랜드가 넣은 라이브 커머스 영상 (없으면 null → 메인 영상을 쓴다) */
export async function getBrandShopVideos(shopId: string): Promise<Record<HomeVideoCategory, HomeVideoItem[]> | null> {
  const rows = await prisma.brandShopVideo.findMany({ where: { shopId, isVisible: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 30 });
  const items = rows.flatMap((r) => { const item = toHomeVideoItem({ ...r, category: "LIVE_COMMERCE" }); return item ? [item] : []; });
  return items.length ? { LIVE_COMMERCE: items } : null;
}
