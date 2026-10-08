import { prisma } from "@/lib/prisma";
import { getProfileImage, stableProfileIndex } from "@/lib/profile";

export const FACILITY_BANNERS = [
  { url: "/images/facility-banners/warehouse-premium.webp", label: "프리미엄 물류 창고" },
  { url: "/images/facility-banners/live-studio.webp", label: "라이브 커머스 스튜디오" },
  { url: "/images/facility-banners/creator-studio.webp", label: "크리에이터 스튜디오" },
  { url: "/images/facility-banners/smart-fulfillment.webp", label: "스마트 풀필먼트" },
  { url: "/images/facility-banners/beauty-live.webp", label: "뷰티·패션 라이브" },
] as const;

export const FACILITY_PROFILE_IMAGES = Array.from({ length: 20 }, (_, index) => ({
  url: getProfileImage(index + 1),
  label: `프로필 ${index + 1}`,
}));

export const FACILITY_PAGE_THEMES = {
  gold: { label: "셀러브릭스 골드", accent: "#F5A623" },
  blue: { label: "신뢰 블루", accent: "#3B82F6" },
  green: { label: "성장 그린", accent: "#10B981" },
  coral: { label: "크리에이터 코랄", accent: "#F97360" },
} as const;

export type FacilityPageTheme = keyof typeof FACILITY_PAGE_THEMES;

export type FacilityPageConfig = {
  pageTitle: string;
  tagline: string;
  intro: string;
  bannerUrl: string;
  profileImageUrl: string;
  theme: FacilityPageTheme;
  ctaLabel: string;
  showEquipment: boolean;
  showSchedule: boolean;
  showProducts: boolean;
};

export const facilityPageSettingKey = (facilityId: string) => `facility-page:${facilityId}`;

export function defaultBannerFor(facilityId: string) {
  let hash = 0;
  for (let i = 0; i < facilityId.length; i += 1) hash = (hash * 31 + facilityId.charCodeAt(i)) >>> 0;
  return FACILITY_BANNERS[hash % FACILITY_BANNERS.length].url;
}

export function defaultProfileFor(facilityId: string) {
  return getProfileImage(stableProfileIndex(`facility:${facilityId}`));
}

export function defaultFacilityPageConfig(facility: {
  id: string;
  name: string;
  type: string;
  description?: string | null;
}): FacilityPageConfig {
  const isWarehouse = facility.type === "WAREHOUSE";
  return {
    pageTitle: facility.name,
    tagline: isWarehouse
      ? "보관부터 출고, 라이브 판매까지 한곳에서"
      : "브랜드의 이야기가 매출이 되는 라이브 공간",
    intro: facility.description ?? (isWarehouse
      ? "안전한 보관과 빠른 출고를 위한 시설과 운영 노하우를 제공합니다."
      : "전문 장비와 쾌적한 환경을 갖춘 라이브 커머스 스튜디오입니다."),
    bannerUrl: defaultBannerFor(facility.id),
    profileImageUrl: defaultProfileFor(facility.id),
    theme: "gold",
    ctaLabel: "이 시설 예약하기",
    showEquipment: true,
    showSchedule: true,
    showProducts: true,
  };
}

export function parseFacilityPageConfig(
  facility: { id: string; name: string; type: string; description?: string | null },
  value?: string | null,
): FacilityPageConfig {
  const defaults = defaultFacilityPageConfig(facility);
  if (!value) return defaults;
  try {
    const parsed = JSON.parse(value) as Partial<FacilityPageConfig>;
    return {
      ...defaults,
      ...parsed,
      theme: parsed.theme && parsed.theme in FACILITY_PAGE_THEMES ? parsed.theme : defaults.theme,
      bannerUrl: parsed.bannerUrl?.trim() || defaults.bannerUrl,
      profileImageUrl: parsed.profileImageUrl?.trim() || defaults.profileImageUrl,
    };
  } catch {
    return defaults;
  }
}

export async function getFacilityPageConfig(facility: {
  id: string;
  name: string;
  type: string;
  description?: string | null;
}) {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: facilityPageSettingKey(facility.id) } });
    return parseFacilityPageConfig(facility, setting?.value);
  } catch {
    return defaultFacilityPageConfig(facility);
  }
}
