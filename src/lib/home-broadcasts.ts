export type HomeLiveBroadcast = {
  slug: string;
  title: string;
  seller: string;
  channel: string;
  channelUrl: string;
  youtubeId: string | null;
  thumbnailUrl?: string | null; // 방송 썸네일 (없으면 기본 포스터)
  embedUrl?: string | null;     // 셀러브릭스 등 허용된 호스트의 플레이어 주소 (메인에서 바로 재생)
  hlsUrl?: string | null;       // 셀러브릭스 자체 송출 HLS 주소 (지금은 저장만 — 재생은 embedUrl 로)
  source?: "MANUAL" | "SELLERBRICKS";
};

export type HomeBroadcastClip = {
  id: string;
  title: string;
  source: string;
  poster: string;
  video: string;
  duration: string;
  sample?: boolean;
};

// 실제 편집본이 준비되면 셀러·행사명과 포스터, 재생 주소를 등록한다.
export const HOME_BROADCAST_CLIPS: HomeBroadcastClip[] = [
  {
    id: "beauty-studio",
    title: "뷰티 신상 쇼케이스",
    source: "뷰티 스튜디오",
    poster: "/media/broadcasts/beauty-studio.webp",
    video: "/media/broadcasts/beauty-studio.mp4",
    duration: "0:30",
    sample: true,
  },
  {
    id: "farm-market",
    title: "산지 직송 마켓",
    source: "농장 라이브",
    poster: "/media/broadcasts/farm-market.webp",
    video: "/media/broadcasts/farm-market.mp4",
    duration: "0:30",
    sample: true,
  },
  {
    id: "warehouse-market",
    title: "창고 특가전 하이라이트",
    source: "창고 라이브",
    poster: "/media/broadcasts/warehouse-market.webp",
    video: "/media/broadcasts/warehouse-market.mp4",
    duration: "0:30",
    sample: true,
  },
];
