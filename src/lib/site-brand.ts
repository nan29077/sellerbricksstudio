export const SITE_NAME = "스토리지마켓";
export const SITE_NAME_EN = "STORAGE MARKET";
/** 페이지가 따로 제목을 정하지 않았을 때의 브라우저 탭 제목 */
export const DEFAULT_SITE_TITLE = `${SITE_NAME} | 좋은 상품이 더 멀리 닿는 라이브`;

export const SITE_LOGO = {
  light: "/images/brand/storage-market-logo-on-light.png",
  dark: "/images/brand/storage-market-logo-on-dark.png",
  width: 1926,
  height: 246,
} as const;

export function normalizeLegacyBrand(text: string): string {
  return text
    .replace(/셀러[ \t]*브릭스(?:[ \t]*스튜디오)?/g, SITE_NAME)
    .replace(/(?<![\w@.\/-])Seller[ \t]*Bricks(?:[ \t]+Studio)?\b(?![@.\/-]\w)/gi, SITE_NAME_EN);
}
