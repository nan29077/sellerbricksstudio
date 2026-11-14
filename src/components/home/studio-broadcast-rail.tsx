// 메인 외 스튜디오 화면(문의 · 브랜드샵 · 공간 찾기 등)에서도 PC 왼쪽에 '라이브 커머스' 플레이어를 띄운다. (2026-11-14)
import { HomeBroadcastPlayer } from "@/components/home/home-broadcast-player";
import { getHomeVideos, type HomeVideoCategory, type HomeVideoItem } from "@/lib/home-videos";
import styles from "@/app/(studio)/studio.module.css";
import rail from "./studio-broadcast-rail.module.css";

// videos를 주면 그 영상(예: 브랜드샵의 라이브 커머스 영상)을, 없으면 메인 영상을 보여 준다
export async function StudioBroadcastRail({ videos: own, title }: { videos?: Record<HomeVideoCategory, HomeVideoItem[]> | null; title?: string }) {
  const videos = own ?? await getHomeVideos().catch(() => null);
  return (
    <div className={`${styles.broadcast} ${rail.railOnly}`}>
      <HomeBroadcastPlayer videos={videos} title={own ? title : undefined} />
    </div>
  );
}
