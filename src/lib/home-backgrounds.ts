export const HOME_BACKGROUND_SAMPLES = [
  { id: "studio-people", label: "함께 만드는 라이브", description: "진행자와 촬영자가 함께하는 따뜻한 스튜디오", style: "실사형" },
  { id: "fulfillment-people", label: "정성을 담은 배송", description: "상품을 포장하고 배송을 준비하는 셀러", style: "실사형" },
  { id: "farm-people", label: "산지에서 만나는 사람들", description: "수확한 상품을 소개하는 농가와 크리에이터", style: "실사형" },
  { id: "flower-illustration", label: "마음을 전하는 꽃가게", description: "꽃과 선물을 주고받는 포근한 입체 일러스트", style: "일러스트형" },
  { id: "seller-illustration", label: "우리들의 셀러 작업실", description: "상품 소개와 포장을 함께하는 입체 일러스트", style: "일러스트형" },
] as const;

export const LEGACY_HOME_BACKGROUNDS = [
  { id: "studio", label: "라이브 스튜디오", description: "네이비와 골드 조명으로 연출한 촬영 공간" },
  { id: "fulfillment", label: "풀필먼트 센터", description: "정돈된 랙과 따뜻한 조명의 물류 창고" },
  { id: "farm", label: "산지의 아침", description: "햇살이 드는 온실과 푸른 작물" },
  { id: "showroom", label: "브랜드 쇼룸", description: "제품 진열대와 은은한 앰버 조명" },
  { id: "control-room", label: "라이브 컨트롤룸", description: "방송 모니터와 믹싱 콘솔이 놓인 공간" },
] as const;

export const HOME_BACKGROUNDS = [...HOME_BACKGROUND_SAMPLES, ...LEGACY_HOME_BACKGROUNDS] as const;

export type HomeBackgroundId = (typeof HOME_BACKGROUNDS)[number]["id"];

export function isHomeBackground(value: unknown): value is HomeBackgroundId {
  return HOME_BACKGROUNDS.some((background) => background.id === value);
}

export function homeBackgroundImage(id: HomeBackgroundId) {
  return `/images/home/backgrounds/${id}.webp`;
}
