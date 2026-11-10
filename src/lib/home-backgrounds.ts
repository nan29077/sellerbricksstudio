export const HOME_BACKGROUNDS = [
  { id: "studio", label: "라이브 스튜디오", description: "네이비와 골드 조명으로 연출한 촬영 공간" },
  { id: "fulfillment", label: "풀필먼트 센터", description: "정돈된 랙과 따뜻한 조명의 물류 창고" },
  { id: "farm", label: "산지의 아침", description: "햇살이 드는 온실과 푸른 작물" },
  { id: "showroom", label: "브랜드 쇼룸", description: "제품 진열대와 은은한 앰버 조명" },
  { id: "control-room", label: "라이브 컨트롤룸", description: "방송 모니터와 믹싱 콘솔이 놓인 공간" },
] as const;

export type HomeBackgroundId = (typeof HOME_BACKGROUNDS)[number]["id"];

export function isHomeBackground(value: unknown): value is HomeBackgroundId {
  return HOME_BACKGROUNDS.some((background) => background.id === value);
}

export function homeBackgroundImage(id: HomeBackgroundId) {
  return `/images/home/backgrounds/${id}.webp`;
}
