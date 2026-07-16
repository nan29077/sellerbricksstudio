import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  name: z.string().min(1, "이름을 입력하세요."),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  role: z.enum(["SELLER", "FACILITY_ADMIN", "MANAGER"]),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const bookingSchema = z.object({
  facilityId: z.string().min(1),
  startAt: z.string().min(1, "시작 시간을 선택하세요."),
  endAt: z.string().min(1, "종료 시간을 선택하세요."),
  purpose: z.string().optional(),
  expectedProducts: z.string().optional(),
});

export const facilityProductSchema = z.object({
  name: z.string().min(1, "상품명을 입력하세요."),
  sku: z.string().optional(),
  category: z.string().min(1, "카테고리를 입력하세요."),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  salePrice: z.coerce.number().int().min(0),
  consumerPrice: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0),
  shippingInfo: z.string().optional(),
  commissionType: z.enum(["PERCENT", "FIXED"]),
  commissionValue: z.coerce.number().min(0),
  isSellable: z.boolean().default(true),
});

export const liveSessionSchema = z.object({
  bookingId: z.string().optional(),
  facilityId: z.string().min(1),
  title: z.string().min(1, "방송 제목을 입력하세요."),
  description: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  snsChannels: z.array(z.object({
    type: z.enum(["YOUTUBE", "INSTAGRAM", "TIKTOK", "ETC", "CATENOID"]),
    url: z.string().optional(),
  })).optional(),
});

export const addLiveProductSchema = z.object({
  facilityProductId: z.string().optional(),
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
  buyerName: z.string().min(1, "이름을 입력하세요."),
  buyerPhone: z.string().min(8, "연락처를 입력하세요."),
  buyerAddress: z.string().optional(),
  method: z.enum(["CARD", "EASY_PAY", "BANK_TRANSFER"]),
  items: z.array(z.object({
    liveSessionProductId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
    optionLabel: z.string().optional(),
  })).min(1, "상품을 1개 이상 담아주세요."),
});

export const sendAlimtalkSchema = z.object({
  liveSessionId: z.string().min(1),
  channelId: z.string().min(1),
  templateCode: z.string().min(1),
});
