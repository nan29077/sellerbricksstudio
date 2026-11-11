const brandArtwork = [
  ["brand-beauty", "뷰티 랩"],
  ["brand-fashion", "패션 쇼룸"],
  ["brand-accessories", "핸드메이드 아틀리에"],
  ["brand-food", "푸드 스튜디오"],
  ["brand-illustration", "선물가게 일러스트"],
] as const;

const facilityArtwork = [
  ["facility-fulfillment", "풀필먼트 작업실"],
  ["facility-live", "라이브 커머스 스튜디오"],
  ["facility-logistics", "물류 센터"],
  ["facility-daylight", "자연광 촬영 스튜디오"],
  ["facility-illustration", "창고 스튜디오 일러스트"],
] as const;

function withImageUrls(entries: ReadonlyArray<readonly [string, string]>) {
  return entries.map(([name, label]) => ({ url: `/images/shop-artwork/${name}.webp`, label }));
}

export const BRAND_ARTWORK = withImageUrls(brandArtwork);
export const FACILITY_ARTWORK = withImageUrls(facilityArtwork);

export function isShopImageUrl(value: string) {
  if (/^\/images\/[\w./-]+$/.test(value) && !value.split("/").includes("..")) return true;
  if (!value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
