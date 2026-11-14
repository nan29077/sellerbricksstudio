import { z } from "zod";
import { isCategory } from "./categories";

export const signupSchema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(100),
  name: z.string().trim().min(1, "이름을 입력하세요.").max(40),
  phone: z.string().trim().max(30).optional(),
  companyName: z.string().trim().max(60).optional(),
  businessNumber: z.string().trim().max(20).regex(/^[0-9-]*$/, "사업자등록번호는 숫자와 - 만 입력하세요.").optional(),
  categories: z.array(z.string().refine(isCategory, "알 수 없는 카테고리입니다.")).max(17).optional(),
  // 직접 가입은 셀러 · 브랜드사만. 창고(스튜디오)는 본사가 운영하고, 창고 운영 매니저는 최고관리자가 만든다.
  role: z.enum(["SELLER", "BRAND_ADMIN"], { errorMap: () => ({ message: "가입할 수 없는 회원 유형입니다." }) }),
  agreeTerms: z.literal(true, { errorMap: () => ({ message: "이용약관에 동의해 주세요." }) }),
  agreePrivacy: z.literal(true, { errorMap: () => ({ message: "개인정보 수집·이용에 동의해 주세요." }) }),
}).superRefine((v, ctx) => {
  if (v.role !== "BRAND_ADMIN") return;
  if (!v.companyName || v.companyName.length < 2) ctx.addIssue({ code: "custom", path: ["companyName"], message: "브랜드(회사)명을 2자 이상 입력하세요." });
  if (!v.categories?.length) ctx.addIssue({ code: "custom", path: ["categories"], message: "취급 카테고리를 1개 이상 선택하세요." });
});
export type SignupInput = z.infer<typeof signupSchema>;

export const bookingSchema = z.object({
  facilityId: z.string().min(1),
  startAt: z.string().min(1, "시작 시간을 선택하세요."),
  endAt: z.string().min(1, "종료 시간을 선택하세요."),
  purpose: z.string().max(200).optional(),
  expectedProducts: z.string().max(500).optional(),
  headcount: z.coerce.number().int().min(1).max(500).optional(),
  requestNote: z.string().max(1000).optional(),
  // 방송에서 판매할 창고(스튜디오) 상품과 수량
  products: z.array(z.object({
    facilityProductId: z.string().min(1),
    quantity: z.coerce.number().int().min(1, "수량은 1개 이상입니다.").max(100000),
  })).max(50, "상품은 50개까지 선택할 수 있습니다.").optional(),
  repeatWeeks: z.coerce.number().int().min(1).max(12).optional(), // 매주 반복 횟수 (1 = 반복 없음)
  skipConflicts: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const facilityProductSchema = z.object({
  name: z.string().min(1, "상품명을 입력하세요."),
  sku: z.string().optional(),
  category: z.string().min(1, "카테고리를 입력하세요."),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  salePrice: z.coerce.number().int().min(0),
  consumerPrice: z.coerce.number().int().min(0),
  // 셀러 공급가: 판매되면 창고(스튜디오)가 받는 금액. 비우면 셀러 수수료 방식
  supplyPrice: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.union([z.coerce.number().int().min(0, "공급가는 0원 이상입니다.").max(100_000_000), z.null()])).optional(),
  stock: z.coerce.number().int().min(0),
  shippingInfo: z.string().optional(),
  commissionType: z.enum(["PERCENT", "FIXED"]),
  commissionValue: z.coerce.number().min(0),
  isSellable: z.boolean().default(true),
});

export const liveSessionSchema = z.object({
  bookingId: z.string().optional(),
  facilityId: z.string().min(1).optional(), // 비우면 셀러 본인 공간 방송
  title: z.string().min(1, "방송 제목을 입력하세요."),
  description: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  snsChannels: z.array(z.object({
    type: z.enum(["YOUTUBE", "INSTAGRAM", "TIKTOK", "ETC"]),
    url: z.string().max(500).optional().nullable(),
  })).optional(),
});

export const addLiveProductSchema = z.object({
  facilityProductId: z.string().optional(),
  sellerBrandProductId: z.string().max(64).optional(), // 셀러가 브랜드샵에서 가져온 직배송 상품
  displayNumber: z.coerce.number().int().min(1).optional(),
  // 임시상품 직접 입력
  name: z.string().optional(),
  price: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  image: z.string().optional(),
});

export const updateNumberSchema = z.object({
  liveSessionProductId: z.string().min(1),
  newNumber: z.coerce.number().int().min(1),
});

export const checkoutSchema = z.object({
  sessionSlug: z.string().min(1),
  buyerName: z.string().trim().min(1, "이름을 입력하세요.").max(40),
  buyerPhone: z.string().trim().regex(/^[0-9\-+ ]{8,20}$/, "연락처를 정확히 입력하세요."),
  buyerAddress: z.string().trim().max(300).optional(),
  method: z.enum(["CARD", "EASY_PAY", "BANK_TRANSFER"]),
  couponCode: z.string().trim().max(20).optional(),
  items: z.array(z.object({
    liveSessionProductId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(99, "한 상품은 최대 99개까지 주문할 수 있습니다."),
    optionLabel: z.string().optional(),
  })).min(1, "상품을 1개 이상 담아주세요."),
  agreePrivacy: z.literal(true, { errorMap: () => ({ message: "개인정보 수집·이용 및 판매자 제공에 동의해 주세요." }) }),
});

export const sendAlimtalkSchema = z.object({
  liveSessionId: z.string().min(1),
  channelId: z.string().min(1),
  templateCode: z.string().min(1),
});
