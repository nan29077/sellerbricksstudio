// 공유 데모(더미) 라이브 세션 데이터.
// DB에 라이브 세션이 없을 때 목록/상세 페이지가 동일한 데이터를 사용하도록 한다.
// 상세 페이지에서 findUnique가 null이어도 이 데이터를 fallback으로 렌더하여
// "상세보기" 클릭 시 발생하던 notFound/런타임 에러를 방지한다.

export type DemoLiveSession = {
  id: string;
  slug: string;
  status: "DRAFT" | "READY" | "LIVE" | "ENDED" | "CANCELLED";
  title: string;
  sellerId: string;
  scheduledStart: Date;
  facility: { name: string; ownerId: string };
  buyerLinkUrl: string;
  selfStreamUrl: string | null;
  catenoidPlaybackUrl: string | null;
  alimtalkStatus: "PENDING" | "SENT";
  streamChannels: { id: string; type: string }[];
  _count: { products: number; orders: number };
};

export const DEMO_LIVE_SESSIONS: DemoLiveSession[] = [
  {
    id: "ls1",
    slug: "demo-beauty-summer",
    status: "LIVE",
    title: "뷰티 신상 여름 컬렉션 라이브",
    sellerId: "demo-seller",
    scheduledStart: new Date("2026-06-20T14:00:00"),
    facility: { name: "강남 프리미엄 라이브 스튜디오", ownerId: "demo-facility" },
    buyerLinkUrl: "https://sellerbricks.kr/live/demo-beauty-summer",
    selfStreamUrl: "rtmp://stream.sellerbricks.kr/live/demo-beauty-summer",
    catenoidPlaybackUrl: "https://cdn.catenoid.net/demo-beauty-summer/index.m3u8",
    alimtalkStatus: "SENT",
    streamChannels: [{ id: "sc1", type: "YOUTUBE" }, { id: "sc2", type: "KAKAO" }],
    _count: { products: 12, orders: 87 },
  },
  {
    id: "ls2",
    slug: "demo-food-special",
    status: "READY",
    title: "식품 특가전 라이브 방송",
    sellerId: "demo-seller",
    scheduledStart: new Date("2026-06-22T10:00:00"),
    facility: { name: "성수 인더스트리얼 스튜디오", ownerId: "demo-facility" },
    buyerLinkUrl: "https://sellerbricks.kr/live/demo-food-special",
    selfStreamUrl: "rtmp://stream.sellerbricks.kr/live/demo-food-special",
    catenoidPlaybackUrl: null,
    alimtalkStatus: "PENDING",
    streamChannels: [{ id: "sc3", type: "NAVER" }],
    _count: { products: 8, orders: 0 },
  },
  {
    id: "ls3",
    slug: "demo-fashion-spring",
    status: "ENDED",
    title: "패션 봄 신상 라이브",
    sellerId: "demo-seller",
    scheduledStart: new Date("2026-06-10T13:00:00"),
    facility: { name: "판교 IT 테크 스튜디오", ownerId: "demo-facility" },
    buyerLinkUrl: "https://sellerbricks.kr/live/demo-fashion-spring",
    selfStreamUrl: "rtmp://stream.sellerbricks.kr/live/demo-fashion-spring",
    catenoidPlaybackUrl: "https://cdn.catenoid.net/demo-fashion-spring/index.m3u8",
    alimtalkStatus: "SENT",
    streamChannels: [{ id: "sc4", type: "YOUTUBE" }],
    _count: { products: 15, orders: 234 },
  },
];

export function getDemoLiveSession(id: string): DemoLiveSession | undefined {
  return DEMO_LIVE_SESSIONS.find((s) => s.id === id);
}
