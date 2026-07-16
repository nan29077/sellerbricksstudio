import { promises as fs } from "fs";
import path from "path";

// 사이트 전역 설정.
// Prisma Setting 테이블에 의존하지 않고 파일(data/settings.json) 기반으로 저장한다.
// 따라서 db:push(마이그레이션)를 돌리지 않아도 ON/OFF·사이트 설정 저장이 동작하고,
// 새로고침/재시작 후에도 값이 유지된다. 파일 접근 실패 시에도 기본값으로 안전하게 동작한다.
export type SiteSettings = {
  siteName: string;
  siteDescription: string;
  bannerEnabled: boolean;
  bannerText: string;
  bannerLinkLabel: string;
  bannerLinkUrl: string;
  liveEnabled: boolean;
  managerDisabled: boolean;
  facilityDisabled: boolean;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "셀러 브릭스",
  siteDescription: "라이브 커머스 셀러를 위한 올인원 셀러 매니지먼트 플랫폼",
  bannerEnabled: false,
  bannerText: "🎉 셀러브릭스 셀러 매니지먼트, 지금 무료로 시작하세요!",
  bannerLinkLabel: "자세히 보기",
  bannerLinkUrl: "/register",
  liveEnabled: true,
  managerDisabled: false,
  facilityDisabled: false,
};

const BOOL_KEYS: (keyof SiteSettings)[] = ["bannerEnabled", "liveEnabled", "managerDisabled", "facilityDisabled"];

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

function coerce(raw: SiteSettings): SiteSettings {
  // 저장된 값과 기본값을 병합하고 타입을 보정한다.
  const merged: SiteSettings = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  for (const key of BOOL_KEYS) {
    const v = (merged as any)[key];
    (merged as any)[key] = typeof v === "boolean" ? v : v === "true";
  }
  return merged;
}

export async function getSettings(): Promise<SiteSettings> {
  try {
    const text = await fs.readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(text);
    // 허용된 키만 반영
    const picked: Partial<SiteSettings> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]) {
      if (key in parsed) (picked as any)[key] = parsed[key];
    }
    return coerce(picked as SiteSettings);
  } catch {
    // 파일이 아직 없거나 읽기 실패 시 기본값 (앱 동작 유지)
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(patch: Partial<SiteSettings>): Promise<void> {
  const current = await getSettings();
  const next: SiteSettings = { ...current };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]) {
    if (key in patch && patch[key] !== undefined) {
      (next as any)[key] = patch[key];
    }
  }
  const coerced = coerce(next);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(coerced, null, 2), "utf-8");
}
