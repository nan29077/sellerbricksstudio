export const PROFILE_ANIMALS = [
  { id: "cat", label: "고양이" },
  { id: "dog", label: "강아지" },
  { id: "rabbit", label: "토끼" },
  { id: "bear", label: "곰" },
  { id: "fox", label: "여우" },
  { id: "panda", label: "판다" },
  { id: "koala", label: "코알라" },
  { id: "otter", label: "수달" },
  { id: "raccoon", label: "너구리" },
  { id: "deer", label: "사슴" },
  { id: "hamster", label: "햄스터" },
  { id: "squirrel", label: "다람쥐" },
  { id: "hedgehog", label: "고슴도치" },
  { id: "lion", label: "사자" },
  { id: "tiger", label: "호랑이" },
  { id: "leopard", label: "표범" },
  { id: "elephant", label: "코끼리" },
  { id: "giraffe", label: "기린" },
  { id: "zebra", label: "얼룩말" },
  { id: "hippo", label: "하마" },
  { id: "penguin", label: "펭귄" },
  { id: "owl", label: "부엉이" },
  { id: "duck", label: "오리" },
  { id: "chick", label: "병아리" },
  { id: "seal", label: "물범" },
  { id: "alpaca", label: "알파카" },
  { id: "sheep", label: "양" },
  { id: "cow", label: "젖소" },
  { id: "pig", label: "돼지" },
  { id: "frog", label: "개구리" },
] as const;

export function isProfileImageIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= PROFILE_ANIMALS.length;
}

export function getProfileImage(index?: number | null): string {
  const animal = PROFILE_ANIMALS[isProfileImageIndex(index) ? index - 1 : 0];
  return `/images/profiles/animals-plush/${animal.id}.webp`;
}

export function randomProfileIndex(): number {
  return Math.floor(Math.random() * PROFILE_ANIMALS.length) + 1;
}

// 아직 배정되지 않은 계정도 같은 키에는 같은 동물을 표시합니다.
export function stableProfileIndex(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return (hash % PROFILE_ANIMALS.length) + 1;
}

export function defaultProfileImage(key: string): string {
  return getProfileImage(stableProfileIndex(key));
}

export function legacyProfileImageIndex(url: string): number | null {
  const match = url.match(/^\/images\/profiles\/(male|female)-(10|[1-9])\.png(?:[?#].*)?$/);
  return match ? Number(match[2]) + (match[1] === "female" ? 10 : 0) : null;
}

export function previousAnimalImageIndex(url: string): number | null {
  const id = url.match(/^\/images\/profiles\/animals\/([a-z]+)\.webp(?:[?#].*)?$/)?.[1];
  const index = PROFILE_ANIMALS.findIndex((animal) => animal.id === id);
  return index < 0 ? null : index + 1;
}

export function resolveProfileAvatar(index: number | null | undefined, avatarUrl: string | null | undefined, key: string) {
  const url = avatarUrl?.trim();
  const legacyIndex = url ? legacyProfileImageIndex(url) : null;
  const imageIndex = isProfileImageIndex(index) ? index : legacyIndex ?? stableProfileIndex(key);
  const previousAnimalIndex = url ? previousAnimalImageIndex(url) : null;
  const photoUrl = previousAnimalIndex ? getProfileImage(previousAnimalIndex)
    : url && legacyIndex === null && /^(?:\/(?!\/)|https?:\/\/|data:image\/jpeg;base64,)/i.test(url) ? url : null;
  return { imageIndex, photoUrl, src: photoUrl ?? getProfileImage(imageIndex) };
}
