// 회원 프로필 이미지 유틸
// public/images/profiles/ 에 male-1~10.png, female-1~10.png 20개 준비됨.
// index 1~10  -> male-1~10
// index 11~20 -> female-1~10

export function getProfileImage(index: number | null | undefined): string {
  if (!index) return "/images/profiles/male-1.png";
  if (index <= 10) return `/images/profiles/male-${index}.png`;
  return `/images/profiles/female-${index - 10}.png`;
}

// 1~20 랜덤 인덱스 (가입 시 배정용)
export function randomProfileIndex(): number {
  return Math.floor(Math.random() * 20) + 1;
}

// profileImageIndex 가 없는(데모/미배정) 사용자를 위한 결정적 폴백 인덱스.
// 같은 key(email 등)면 항상 같은 이미지를 돌려주어 하이드레이션 불일치를 방지.
export function stableProfileIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return (h % 20) + 1;
}

// index 우선, 없으면 key 기반 결정적 폴백으로 이미지 경로 반환
export function resolveProfileImage(index: number | null | undefined, key: string): string {
  const idx = index ?? stableProfileIndex(key);
  return getProfileImage(idx);
}
