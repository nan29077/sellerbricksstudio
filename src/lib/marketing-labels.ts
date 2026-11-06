export const PLATFORMS: Record<string, { label: string; color: string }> = {
  YOUTUBE: { label: "YouTube", color: "bg-red-50 text-red-600 border-red-100" },
  INSTAGRAM: { label: "Instagram", color: "bg-pink-50 text-pink-600 border-pink-100" },
  TIKTOK: { label: "TikTok", color: "bg-slate-100 text-slate-700 border-slate-200" },
  FACEBOOK: { label: "Facebook", color: "bg-blue-50 text-blue-600 border-blue-100" },
  NAVER: { label: "네이버", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  ETC: { label: "기타", color: "bg-slate-50 text-slate-600 border-slate-200" },
};
export const PLATFORM_OPTIONS = Object.entries(PLATFORMS).map(([value, v]) => ({ value, label: v.label }));

export const POST_STATUS: Record<string, { label: string; tone: "blue" | "green" | "gray" }> = {
  PLANNED: { label: "예정", tone: "blue" }, POSTED: { label: "게시 완료", tone: "green" }, CANCELLED: { label: "취소", tone: "gray" },
};

export const APPLICATION_TYPES: Record<string, string> = {
  SNS_AD: "SNS 광고 지원", CONTENT: "콘텐츠 제작", INFLUENCER: "인플루언서 연결", ETC: "기타",
};
export const APPLICATION_STATUS: Record<string, { label: string; tone: "yellow" | "blue" | "green" | "red" | "gray" }> = {
  PENDING: { label: "접수", tone: "yellow" }, IN_REVIEW: { label: "검토중", tone: "blue" },
  APPROVED: { label: "승인", tone: "green" }, REJECTED: { label: "반려", tone: "red" }, DONE: { label: "진행 완료", tone: "gray" },
};

export const ASSET_TYPES: Record<string, string> = { IMAGE: "이미지", VIDEO: "영상", COPY: "광고 문구", LINK: "링크" };

export function periodStatus(startAt: Date, endAt: Date, now = new Date()): { key: "UPCOMING" | "ACTIVE" | "ENDED"; label: string; tone: "blue" | "green" | "gray" } {
  if (now < startAt) return { key: "UPCOMING", label: "예정", tone: "blue" };
  if (now > endAt) return { key: "ENDED", label: "종료", tone: "gray" };
  return { key: "ACTIVE", label: "진행중", tone: "green" };
}

export function discountLabel(type: string, value: number) {
  return type === "PERCENT" ? `${value}%` : `${Math.round(value).toLocaleString()}원`;
}
