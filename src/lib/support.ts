import type { SupportCategory } from "@prisma/client";
import { z } from "zod";

export const SUPPORT_CATEGORIES = {
  ACCOUNT: { label: "계정·가입", hint: "어느 화면에서 어떤 상황이 있었는지 알려주세요." },
  SPACE_BOOKING: { label: "공간·예약", hint: "공간 이름, 이용 희망일 또는 예약번호를 알려주세요." },
  LIVE: { label: "라이브 운영", hint: "라이브 세션과 문제가 발생한 단계를 알려주세요." },
  ORDER_PAYMENT: { label: "주문·결제", hint: "주문번호와 확인이 필요한 내용을 알려주세요." },
  SETTLEMENT: { label: "정산", hint: "확인이 필요한 정산 기간과 항목을 알려주세요." },
  PARTNERSHIP: { label: "제휴·입점", hint: "브랜드나 공간 소개와 원하시는 협업 내용을 알려주세요." },
  OTHER: { label: "기타", hint: "운영팀이 확인할 수 있도록 상황을 구체적으로 적어주세요." },
} satisfies Record<SupportCategory, { label: string; hint: string }>;

export function isSupportCategory(value: unknown): value is SupportCategory {
  return typeof value === "string" && Object.hasOwn(SUPPORT_CATEGORIES, value);
}

// 첨부 이미지: 우리 업로드 주소만 (개발: /uploads/…, 배포: S3_PUBLIC_URL …)
export function isOwnUpload(url: string) {
  if (/^\/uploads\/[\w/-]+\.(png|jpe?g|webp|gif)$/i.test(url)) return true;
  const base = (process.env.S3_PUBLIC_URL ?? process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "").replace(/\/$/, "");
  return !!base && url.startsWith(`${base}/`) && /\.(png|jpe?g|webp|gif)$/i.test(url);
}
const attachments = z.array(z.string().trim().max(500)).max(5, "첨부 이미지는 5장까지 올릴 수 있습니다.").default([]);

export const supportInquirySchema = z.object({
  id: z.string().uuid("접수번호가 올바르지 않습니다."),
  category: z.custom<SupportCategory>(isSupportCategory, "문의 유형을 선택해 주세요."),
  subject: z.string().trim().min(4, "제목을 4자 이상 입력해 주세요.").max(100, "제목은 100자까지 입력할 수 있습니다."),
  message: z.string().trim().min(10, "문의 내용을 10자 이상 입력해 주세요.").max(3000, "문의 내용은 3,000자까지 입력할 수 있습니다."),
  reference: z.string().trim().max(100, "관련 번호는 100자까지 입력할 수 있습니다.").optional(),
  // (선택) 문의하기 팝업 · 챗봇에서 넘어온 정보
  attachments: attachments.optional(),
  source: z.enum(["PAGE", "POPUP", "CHATBOT"]).optional(),
  chatTranscript: z.string().max(8000).optional(),
  pagePath: z.string().max(200).optional(),
  // 비회원 문의 (로그인하지 않았을 때만)
  guestName: z.string().trim().min(2, "이름을 2자 이상 입력해 주세요.").max(40).optional(),
  guestEmail: z.string().trim().email("답변을 받을 이메일을 확인해 주세요.").max(120).optional(),
  guestPhone: z.string().trim().max(30).regex(/^[\d\s+()-]*$/, "연락처는 숫자와 - 만 입력해 주세요.").optional(),
  agreePrivacy: z.boolean().optional(),
});

export const supportReplySchema = z.object({
  reply: z.string().trim().min(10, "답변을 10자 이상 입력해 주세요.").max(3000, "답변은 3,000자까지 입력할 수 있습니다."),
});

export const supportFollowUpSchema = z.object({
  body: z.string().trim().min(2, "내용을 입력해 주세요.").max(3000, "3,000자까지 입력할 수 있습니다."),
  attachments: attachments.optional(),
  token: z.string().max(80).optional(), // 비회원 확인용
});

// 처리 상태 · 우선순위
export const SUPPORT_STATUS = {
  OPEN: { label: "새 문의", tone: "yellow" },
  IN_PROGRESS: { label: "처리 중", tone: "blue" },
  ANSWERED: { label: "답변 완료", tone: "green" },
  CLOSED: { label: "종료", tone: "gray" },
} as const;
export type SupportStatus = keyof typeof SUPPORT_STATUS;
export const isSupportStatus = (v: unknown): v is SupportStatus => typeof v === "string" && v in SUPPORT_STATUS;
export const SUPPORT_PRIORITY = { LOW: "낮음", NORMAL: "보통", HIGH: "높음", URGENT: "긴급" } as const;
export type SupportPriority = keyof typeof SUPPORT_PRIORITY;
export const isSupportPriority = (v: unknown): v is SupportPriority => typeof v === "string" && v in SUPPORT_PRIORITY;
export const SUPPORT_SOURCE = { PAGE: "고객센터", POPUP: "문의하기 팝업", CHATBOT: "챗봇 상담" } as const;
/** 답변 기한(첫 답변) — 넘으면 관리 화면에 '지연'으로 표시 */
export const SUPPORT_SLA_HOURS = 24;

/** 예전 데이터(상태 칸이 생기기 전)는 답변 시각으로 상태를 정한다 */
export function effectiveStatus(i: { status: string; answeredAt: Date | null }): SupportStatus {
  if (i.status === "OPEN" && i.answeredAt) return "ANSWERED";
  return isSupportStatus(i.status) ? i.status : "OPEN";
}

/** 대화 목록: 첫 문의 + 대화. 예전 단일 답변(reply)만 있으면 그것도 넣는다 */
export type ThreadItem = { id: string; author: "USER" | "ADMIN"; body: string; attachments: string[]; at: Date };
export function supportThread(i: { id: string; message: string; attachments: string[]; createdAt: Date; reply: string | null; answeredAt: Date | null; messages: { id: string; author: string; body: string; attachments: string[]; createdAt: Date }[] }): ThreadItem[] {
  const list: ThreadItem[] = [{ id: `${i.id}-q`, author: "USER", body: i.message, attachments: i.attachments, at: i.createdAt }];
  for (const m of i.messages) list.push({ id: m.id, author: m.author === "ADMIN" ? "ADMIN" : "USER", body: m.body, attachments: m.attachments, at: m.createdAt });
  if (i.reply && !i.messages.some((m) => m.author === "ADMIN")) list.push({ id: `${i.id}-legacy`, author: "ADMIN", body: i.reply, attachments: [], at: i.answeredAt ?? i.createdAt });
  return list.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export const supportFaq = [
  { category: "SPACE_BOOKING", question: "원하는 공간을 어떻게 예약하나요?", answer: "셀러 대시보드의 '방송 예약하기'에서 방송할 브랜드 상품을 고르고, 창고 · 스튜디오 · 쇼룸과 날짜를 정해 신청합니다. 예약 상태는 '예약 · 방송 일정'에서 확인할 수 있어요.", href: "/seller/bookings/new", link: "방송 예약하기" },
  { category: "SPACE_BOOKING", question: "예약할 때 고른 브랜드 상품은 언제 공간에 오나요?", answer: "예약이 승인되면 브랜드에 방송 시연품이 자동으로 요청되고, 방송 2일 전까지 예약한 공간으로 도착합니다. 도착 여부는 예약 화면과 '샘플 · 시연품 신청 내역'에서 볼 수 있어요.", href: "/seller/brand-requests?kind=DISPLAY", link: "시연품 진행 보기" },
  { category: "ORDER_PAYMENT", question: "외부 플랫폼에서 판매한 주문은 어떻게 보내나요?", answer: "셀러 대시보드의 주문서 작성에서 화면으로 입력하거나 엑셀(CSV)로 올립니다. 공급가(스토리지마켓 출고 상품은 배송비 포함)를 결제하면 브랜드 · 스토리지마켓으로 바로 전달되고, 받는 분에게 발송됩니다. 구매자가 스토리지마켓에서 직접 주문하는 기능은 없습니다.", href: "/login", link: "로그인하기" },
  { category: "LIVE", question: "어떤 라이브 플랫폼에서 판매할 수 있나요?", answer: "셀러브릭스 · 클릭메이트 · 그립 · 바이브 · 모루라이브 · 라이브마켓 · 네이버 쇼핑라이브 · 유튜브 · 틱톡 · 인스타그램 등 셀러가 쓰는 플랫폼에서 판매하면 됩니다. 쓰는 플랫폼은 가입할 때와 설정에서 고를 수 있습니다.", href: "/intro", link: "서비스 알아보기" },
  { category: "SETTLEMENT", question: "결제 · 정산 내역은 어디에서 확인하나요?", answer: "셀러는 결제 · 정산 내역에서 주문서 결제와 환불을, 브랜드사는 정산 메뉴에서 공급대금 정산을 확인할 수 있습니다.", href: "/login", link: "로그인하기" },
  { category: "ACCOUNT", question: "어떤 역할로 가입해야 하나요?", answer: "라이브 판매를 준비한다면 셀러로, 상품을 공급한다면 브랜드사로 가입하세요. 창고 · 스튜디오 · 쇼룸은 스토리지마켓이 직접 운영하므로 따로 가입하지 않습니다.", href: "/signup", link: "가입 유형 보기" },
  { category: "PARTNERSHIP", question: "운영 중인 공간을 제휴하고 싶어요.", answer: "스토리지마켓의 창고 · 스튜디오 · 쇼룸은 본사가 직접 운영하거나 직접 관리할 수 있는 제휴 창고만 씁니다. 제휴를 원하시면 고객 문의로 남겨 주세요. 별도 계정 가입은 없습니다.", href: "/support", link: "제휴 문의하기" },
] satisfies { category: SupportCategory; question: string; answer: string; href: string; link: string }[];

/** 다른 역할 전용 화면으로 가는 안내 링크는 숨긴다 (예: 브랜드 계정에 '방송 예약하기'). 비회원은 로그인 화면으로 이어지므로 그대로 둔다. */
export function linkAllowed(href: string, role?: string | null) {
  if (!role) return true;
  if (href.startsWith("/seller/")) return role === "SELLER";
  if (href.startsWith("/brand/")) return role === "BRAND_ADMIN";
  if (href.startsWith("/admin/")) return role === "SUPER_ADMIN";
  if (href.startsWith("/facility/")) return role === "SUPER_ADMIN" || role === "MANAGER";
  if (href.startsWith("/manager/")) return role === "MANAGER";
  return true;
}

/** 고객이 아직 안 읽은 운영팀 답변이 있는지 (예전 데이터는 답변 시각으로 본다) */
export function hasUnreadForUser(i: { lastAdminReplyAt: Date | null; answeredAt: Date | null; userReadAt: Date | null }) {
  const last = i.lastAdminReplyAt ?? i.answeredAt;
  return !!last && (!i.userReadAt || last > i.userReadAt);
}
/** 운영팀이 아직 안 읽은 고객 메시지가 있는지 */
export function hasUnreadForAdmin(i: { createdAt: Date; lastUserReplyAt: Date | null; adminReadAt: Date | null }) {
  const last = i.lastUserReplyAt ?? i.createdAt;
  return !i.adminReadAt || last > i.adminReadAt;
}
export const SUPPORT_HOURS = "평일 10:00~18:00";
