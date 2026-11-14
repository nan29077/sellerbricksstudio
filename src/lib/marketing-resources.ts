import { z } from "zod";
import { parseKST } from "./utils";

// 셀러 마케팅 리소스 공통 CRUD 설정. 모든 리소스는 sellerId 로 본인 소유가 보장된다.
const dt = z.string().min(1).transform((v) => parseKST(v.length === 10 ? `${v}T00:00` : v));
const dtOpt = z.string().optional().nullable().transform((v) => (v ? parseKST(v.length === 10 ? `${v}T00:00` : v) : null));
const int0 = z.coerce.number().int().min(0);
const intOpt = z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int().min(0)]).transform((v) => (v === "" || v === undefined ? null : v));
const str = (max = 200) => z.string().trim().max(max);
const strOpt = (max = 2000) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const url = z.string().trim().max(1000).optional().nullable().transform((v) => v || null)
  .refine((v) => !v || /^https?:\/\//.test(v), "링크는 http(s):// 로 시작해야 합니다.");

export const MARKETING_RESOURCES = {
  "sns-accounts": {
    model: "snsAccount",
    schema: z.object({
      platform: z.enum(["YOUTUBE", "INSTAGRAM", "TIKTOK", "FACEBOOK", "NAVER", "ETC"]),
      handle: str(100).min(1, "계정명을 입력하세요."), url, followers: int0,
    }),
    orderBy: { followers: "desc" },
  },
  "sns-posts": {
    model: "snsPost",
    schema: z.object({
      platform: z.enum(["YOUTUBE", "INSTAGRAM", "TIKTOK", "FACEBOOK", "NAVER", "ETC"]),
      title: str().min(1, "제목을 입력하세요."), memo: strOpt(), scheduledAt: dt,
      status: z.enum(["PLANNED", "POSTED", "CANCELLED"]).default("PLANNED"), url,
      views: intOpt, likes: intOpt, comments: intOpt, clicks: intOpt,
    }),
    orderBy: { scheduledAt: "desc" },
  },
  promotions: {
    model: "sellerPromotion",
    schema: z.object({
      title: str().min(1, "제목을 입력하세요."), description: strOpt(), channel: strOpt(100),
      discountType: z.enum(["PERCENT", "FIXED"]).default("PERCENT"), discountValue: z.coerce.number().min(0),
      startAt: dt, endAt: dt, targetAmount: intOpt, resultAmount: intOpt, isPublished: z.coerce.boolean().default(true),
    }).refine((d) => d.endAt > d.startAt, { message: "종료일은 시작일보다 뒤여야 합니다.", path: ["endAt"] }),
    orderBy: { startAt: "desc" },
  },
  assets: {
    model: "marketingAsset",
    schema: z.object({
      title: str().min(1, "제목을 입력하세요."), type: z.enum(["IMAGE", "VIDEO", "COPY", "LINK"]),
      url, content: strOpt(5000), channel: strOpt(100), tags: strOpt(300), isFavorite: z.coerce.boolean().default(false),
    }),
    orderBy: { updatedAt: "desc" },
  },
  applications: {
    model: "marketingApplication",
    schema: z.object({
      type: z.enum(["SNS_AD", "CONTENT", "INFLUENCER", "ETC"]), title: str().min(1, "제목을 입력하세요."),
      content: str(3000).min(10, "신청 내용을 10자 이상 입력하세요."), budget: intOpt, desiredAt: dtOpt,
    }),
    orderBy: { createdAt: "desc" },
  },
} as const;

export type MarketingResource = keyof typeof MARKETING_RESOURCES;
export function isMarketingResource(v: string): v is MarketingResource {
  return v in MARKETING_RESOURCES;
}
