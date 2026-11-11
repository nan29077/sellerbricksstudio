// 스토리지마켓 공통 상품 카테고리 (브랜드 가입 · 브랜드 상품 · 창고(스튜디오) 상품 · 검색에서 같이 사용)
// 대분류 이름은 DB에 그대로 저장되므로, 이름을 바꿀 때는 LEGACY_ALIASES 에 예전 이름을 남겨 두세요.

export const CATEGORY_TREE = [
  { name: "의류", subs: ["여성의류", "남성의류", "언더웨어·잠옷", "아우터", "트레이닝·홈웨어", "빅사이즈"] },
  { name: "코스메틱", subs: ["스킨케어", "메이크업", "헤어·바디", "향수", "남성 화장품", "뷰티 디바이스"] },
  { name: "식품", subs: ["간편식·밀키트", "과자·간식", "음료·커피·차", "가공식품", "베이커리·디저트", "소스·양념"] },
  { name: "건강식품", subs: ["영양제", "홍삼·인삼", "다이어트", "단백질·헬스", "유산균"] },
  { name: "농수산물", subs: ["과일", "채소", "쌀·잡곡", "수산물", "축산물", "지역 특산물"] },
  { name: "패션잡화", subs: ["가방", "신발", "모자·벨트", "지갑", "양말·스타킹", "선글라스·안경"] },
  { name: "주얼리·시계", subs: ["반지·목걸이", "귀걸이", "시계", "헤어 액세서리"] },
  { name: "리빙·인테리어", subs: ["침구", "가구", "수납·정리", "조명", "인테리어 소품", "생활용품"] },
  { name: "주방용품", subs: ["조리도구", "식기", "밀폐·보관", "주방 가전 소품"] },
  { name: "가전·디지털", subs: ["생활가전", "주방가전", "모바일 액세서리", "음향기기", "컴퓨터 주변기기"] },
  { name: "유아동", subs: ["유아 의류", "장난감", "육아용품", "유아식", "출산용품"] },
  { name: "반려동물", subs: ["사료·간식", "용품", "위생·미용", "의류·액세서리"] },
  { name: "스포츠·레저", subs: ["헬스·요가", "골프", "캠핑", "등산·아웃도어", "자전거", "수영"] },
  { name: "문구·취미", subs: ["문구", "도서", "공예·DIY", "악기", "게임·완구"] },
  { name: "자동차용품", subs: ["차량 관리", "인테리어 용품", "전자 기기"] },
  { name: "여행·티켓", subs: ["숙박", "여행 상품", "공연·전시", "체험"] },
  { name: "기타", subs: [] as string[] },
] as const;

export const CATEGORIES = CATEGORY_TREE.map((c) => c.name) as unknown as readonly [string, ...string[]];
export type Category = (typeof CATEGORY_TREE)[number]["name"];

// 예전 이름 → 현재 대분류
const LEGACY_ALIASES: Record<string, Category> = {
  뷰티: "코스메틱", 화장품: "코스메틱", 패션: "의류", 잡화: "패션잡화", 리빙: "리빙·인테리어", 홈리빙: "리빙·인테리어",
  디지털: "가전·디지털", 가전: "가전·디지털", 스포츠: "스포츠·레저", 레저: "스포츠·레저", 주얼리: "주얼리·시계",
  농산물: "농수산물", 수산물: "농수산물",
};

export function normalizeCategory(value: string | null | undefined): Category | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if ((CATEGORIES as readonly string[]).includes(v)) return v as Category;
  return LEGACY_ALIASES[v] ?? null;
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function subCategoriesOf(name: string): readonly string[] {
  return CATEGORY_TREE.find((c) => c.name === name)?.subs ?? [];
}

// 검색 필터: 대분류를 고르면 예전 이름으로 저장된 상품도 함께 찾는다.
export function categoryFilterValues(name: string): string[] {
  const main = normalizeCategory(name);
  if (!main) return [name];
  return [main, ...Object.entries(LEGACY_ALIASES).filter(([, to]) => to === main).map(([from]) => from)];
}
