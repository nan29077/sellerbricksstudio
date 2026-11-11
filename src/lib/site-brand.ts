export const SITE_NAME = "스토리지마켓";
export const SITE_NAME_EN = "STORAGE MARKET";

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
