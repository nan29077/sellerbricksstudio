import { safeHttpUrl, youtubeId } from "./stream-embed";

// 메인 영상 플레이어 — 주소 판별 (브라우저 · 서버 공용, DB 를 쓰지 않는다)
export const HOME_VIDEO_CATEGORIES = {
  LIVE_COMMERCE: { label: "라이브 커머스", desc: "지난 라이브 커머스 · 숏폼 영상" },
  CAMPAIGN: { label: "캠페인 · 행사", desc: "홍보 · 캠페인 · 행사 영상" },
} as const;
export type HomeVideoCategory = keyof typeof HOME_VIDEO_CATEGORIES;
export const isHomeVideoCategory = (v: unknown): v is HomeVideoCategory => typeof v === "string" && v in HOME_VIDEO_CATEGORIES;

export type VideoSource =
  | { kind: "youtube"; id: string; vertical: boolean; embed: string }
  | { kind: "vimeo"; id: string; embed: string }
  | { kind: "file"; src: string }
  | { kind: "link" };

const FILE_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|m3u8)(\?|#|$)/i;

/** 영상 주소가 어떤 방식으로 재생되는지 */
export function videoSourceOf(raw: string | null | undefined): VideoSource | null {
  const v = (raw ?? "").trim();
  if (v.startsWith("/") && !v.startsWith("//")) return FILE_EXT.test(v) ? { kind: "file", src: v } : null; // 사이트 안 파일 (public/…)
  const url = safeHttpUrl(v);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const yt = youtubeId(url);
  if (yt) return { kind: "youtube", id: yt, vertical: /^\/shorts\//.test(u.pathname), embed: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&playsinline=1&rel=0` };
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{6,})/)?.[1];
    if (id) return { kind: "vimeo", id, embed: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&playsinline=1` };
  }
  if (FILE_EXT.test(u.pathname)) return { kind: "file", src: url };
  return { kind: "link" };
}

export const VIDEO_KIND_LABEL: Record<VideoSource["kind"], string> = {
  youtube: "유튜브 — 메인에서 바로 재생", vimeo: "비메오 — 메인에서 바로 재생", file: "영상 파일 — 메인에서 바로 재생", link: "끼워 넣을 수 없는 주소 — '원본에서 보기'로 새 창에서 열림",
};

