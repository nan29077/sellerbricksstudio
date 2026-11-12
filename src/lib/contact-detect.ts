// 플랫폼 밖 직거래로 이어질 수 있는 연락처·계좌 정보 감지 (브랜드 ↔ 판매처 메시지)
// 막지는 않고 표시·기록만 한다. 오탐을 줄이려고 형식이 분명한 것만 잡는다.
export const DIRECT_TRADE_WARNING = "연락처·계좌 정보가 포함된 메시지입니다. 플랫폼을 거치지 않은 직거래는 이용약관에 따라 이용이 제한될 수 있습니다.";

const PATTERNS: [string, RegExp][] = [
  ["휴대전화", /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/],
  ["전화번호", /(?:^|[^\d])0(?:2|[3-6][1-5]|70)[\s.-]?\d{3,4}[\s.-]?\d{4}(?!\d)/],
  ["이메일", /[\w.+-]+@[\w-]+\.[\w.]+/],
  ["메신저", /open\.kakao\.com|카톡\s*(?:아이디|id)|카카오\s*(?:아이디|id)|텔레그램|telegram|라인\s*아이디|wechat|위챗/i],
  // 계좌: 숫자 묶음 3개 이상을 하이픈으로 이은 10~16자리, 또는 '계좌·입금·송금' 근처의 긴 숫자
  ["계좌번호", /(?:계좌|입금|송금|이체)[^\n]{0,20}?\d[\d\s-]{9,18}\d/],
];

// 하이픈으로 이은 숫자 묶음 3~4개 중 숫자가 10~16자리인 것 (날짜 2026-11-12 같은 8자리는 제외)
const HYPHEN_NUMBER = /(?<![\d-])\d{2,6}(?:-\d{2,8}){2,3}(?![\d-])/g;

export function detectContactInfo(text: string): string[] {
  const found = new Set<string>();
  for (const [label, re] of PATTERNS) if (re.test(text)) found.add(label);
  for (const m of text.matchAll(HYPHEN_NUMBER)) {
    const digits = m[0].replace(/-/g, "").length;
    if (digits >= 10 && digits <= 16 && !found.has("휴대전화") && !found.has("전화번호")) { found.add("계좌번호"); break; }
  }
  return Array.from(found);
}
