// 셀러가 판매하는 국내 라이브 커머스 플랫폼 (가입 · 설정 · 주문서에서 함께 쓴다)
//  - code 는 DB에 저장되는 값이라 바꾸지 않는다. 목록에 추가할 때는 맨 끝(기타 앞)에 넣는다.
//  - SELLERBRICKS 는 추후 연동해 판매 수량을 자동으로 확인할 예정 (지금은 다른 플랫폼처럼 주문서를 쓴다)
export type LivePlatform = { code: string; label: string; group: "전문" | "쇼핑몰" | "SNS 직접" | "기타" };

export const LIVE_PLATFORMS: LivePlatform[] = [
  { code: "SELLERBRICKS", label: "셀러브릭스", group: "전문" },
  { code: "CLICKMATE", label: "클릭메이트", group: "전문" },
  { code: "GRIP", label: "그립", group: "전문" },
  { code: "VIBE", label: "바이브", group: "전문" },
  { code: "MORULIVE", label: "모루라이브", group: "전문" },
  { code: "LIVEMARKET", label: "라이브마켓", group: "전문" },
  { code: "JAMLIVE", label: "잼라이브", group: "전문" },
  { code: "NAVER", label: "네이버 쇼핑라이브", group: "쇼핑몰" },
  { code: "KAKAO", label: "카카오 쇼핑라이브", group: "쇼핑몰" },
  { code: "COUPANG", label: "쿠팡라이브", group: "쇼핑몰" },
  { code: "ELEVENST", label: "11번가 LIVE11", group: "쇼핑몰" },
  { code: "GMARKET", label: "G마켓 · 옥션 라이브", group: "쇼핑몰" },
  { code: "SSG", label: "SSG 쓱라이브", group: "쇼핑몰" },
  { code: "LOTTEON", label: "롯데ON 라이브", group: "쇼핑몰" },
  { code: "CJONSTYLE", label: "CJ온스타일 라이브", group: "쇼핑몰" },
  { code: "GSSHOP", label: "GS SHOP 라이브", group: "쇼핑몰" },
  { code: "HMALL", label: "현대Hmall 라이브", group: "쇼핑몰" },
  { code: "MUSINSA", label: "무신사 라이브", group: "쇼핑몰" },
  { code: "OLIVEYOUNG", label: "올리브영 라이브", group: "쇼핑몰" },
  { code: "YOUTUBE", label: "유튜브 직접", group: "SNS 직접" },
  { code: "TIKTOK", label: "틱톡 직접", group: "SNS 직접" },
  { code: "FACEBOOK", label: "페이스북 직접", group: "SNS 직접" },
  { code: "INSTAGRAM", label: "인스타그램 직접", group: "SNS 직접" },
  { code: "ETC", label: "기타 플랫폼", group: "기타" },
];

export const LIVE_PLATFORM_GROUPS = ["전문", "쇼핑몰", "SNS 직접", "기타"] as const;
const BY_CODE = new Map(LIVE_PLATFORMS.map((p) => [p.code, p]));

export const isLivePlatform = (code: unknown): code is string => typeof code === "string" && BY_CODE.has(code);

/** 플랫폼 이름. 기타는 직접 입력한 이름을 붙인다 */
export function livePlatformLabel(code: string | null | undefined, etc?: string | null) {
  if (!code) return "-";
  const p = BY_CODE.get(code);
  if (!p) return code;
  return code === "ETC" && etc?.trim() ? `기타 (${etc.trim()})` : p.label;
}

/** 엑셀 · 화면에서 들어온 플랫폼 이름/코드를 코드로 바꾼다 (못 찾으면 null) */
export function livePlatformCodeOf(input: string | null | undefined): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  if (BY_CODE.has(v.toUpperCase())) return v.toUpperCase();
  const norm = (s: string) => s.replace(/\s|·|\(|\)/g, "").toLowerCase();
  const hit = LIVE_PLATFORMS.find((p) => norm(p.label) === norm(v) || norm(p.label).startsWith(norm(v)));
  return hit?.code ?? null;
}
