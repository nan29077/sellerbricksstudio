// 메인 외 스튜디오 화면(문의 · 브랜드샵 · 공간 찾기 등)에서도 PC 왼쪽에 '라이브 커머스' 플레이어를 띄운다. (2026-11-14)
import { HomeBroadcastPlayer } from "@/components/home/home-broadcast-player";
import { getHomeVideos, type HomeVideoCategory, type HomeVideoItem } from "@/lib/home-videos";
import styles from "@/app/(studio)/studio.module.css";
import rail from "./studio-broadcast-rail.module.css";

// own: 이 화면 전용 영상(예: 브랜드샵 — 그 브랜드의 라이브 커머스 영상). 주지 않으면 메인 영상.
//  브랜드샵처럼 그 화면 영상만 보여 줘야 할 때는 own={{...}} + emptyText (영상이 없으면 안내만)
export async function StudioBroadcastRail({ own, title, emptyText, logo }: {
  own?: Record<HomeVideoCategory, HomeVideoItem[]> | null; title?: string; emptyText?: string; logo?: string | null;
}) {
  const videos = own !== undefined ? own : await getHomeVideos().catch(() => null);
  return (
    <div className={`${styles.broadcast} ${rail.railOnly}`}>
      <HomeBroadcastPlayer videos={videos} title={own !== undefined ? title : undefined} emptyText={own !== undefined ? emptyText : undefined} logo={own !== undefined ? logo : undefined} />
    </div>
  );
}
