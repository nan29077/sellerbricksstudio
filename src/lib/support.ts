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

export const supportInquirySchema = z.object({
  id: z.string().uuid("접수번호가 올바르지 않습니다."),
  category: z.custom<SupportCategory>(isSupportCategory, "문의 유형을 선택해 주세요."),
  subject: z.string().trim().min(4, "제목을 4자 이상 입력해 주세요.").max(100, "제목은 100자까지 입력할 수 있습니다."),
  message: z.string().trim().min(10, "문의 내용을 10자 이상 입력해 주세요.").max(3000, "문의 내용은 3,000자까지 입력할 수 있습니다."),
  reference: z.string().trim().max(100, "관련 번호는 100자까지 입력할 수 있습니다.").optional(),
});

export const supportReplySchema = z.object({
  reply: z.string().trim().min(10, "답변을 10자 이상 입력해 주세요.").max(3000, "답변은 3,000자까지 입력할 수 있습니다."),
});

export const supportFaq = [
  { category: "SPACE_BOOKING", question: "원하는 공간을 어떻게 예약하나요?", answer: "등록 공간의 상세 화면에서 날짜와 시간을 선택해 예약을 신청합니다. 예약 상태는 계정의 예약 관리 화면에서 확인할 수 있습니다.", href: "/facilities", link: "등록 공간 둘러보기" },
  { category: "SPACE_BOOKING", question: "예시 공간을 예약할 수 있나요?", answer: "메인의 예시 공간은 공간 구성과 이용료를 살펴보기 위한 가상 사례입니다. 실제 예약은 등록 공간 상세 화면에서 신청해 주세요.", href: "/facilities", link: "예약 가능한 공간 찾기" },
  { category: "ORDER_PAYMENT", question: "외부 플랫폼에서 판매한 주문은 어떻게 보내나요?", answer: "셀러 대시보드의 주문서 작성에서 화면으로 입력하거나 엑셀(CSV)로 올립니다. 공급가(스토리지마켓 출고 상품은 배송비 포함)를 결제하면 브랜드 · 스토리지마켓으로 바로 전달되고, 받는 분에게 발송됩니다. 구매자가 스토리지마켓에서 직접 주문하는 기능은 없습니다.", href: "/login", link: "로그인하기" },
  { category: "LIVE", question: "어떤 라이브 플랫폼에서 판매할 수 있나요?", answer: "셀러브릭스 · 클릭메이트 · 그립 · 바이브 · 모루라이브 · 라이브마켓 · 네이버 쇼핑라이브 · 유튜브 · 틱톡 · 인스타그램 등 셀러가 쓰는 플랫폼에서 판매하면 됩니다. 쓰는 플랫폼은 가입할 때와 설정에서 고를 수 있습니다.", href: "/intro", link: "서비스 알아보기" },
  { category: "SETTLEMENT", question: "결제 · 정산 내역은 어디에서 확인하나요?", answer: "셀러는 결제 · 정산 내역에서 주문서 결제와 환불을, 브랜드사는 정산 메뉴에서 공급대금 정산을 확인할 수 있습니다.", href: "/login", link: "로그인하기" },
  { category: "ACCOUNT", question: "어떤 역할로 가입해야 하나요?", answer: "라이브 판매를 준비한다면 셀러로, 상품을 공급한다면 브랜드사로 가입하세요. 창고 · 스튜디오 · 쇼룸은 스토리지마켓이 직접 운영하므로 따로 가입하지 않습니다.", href: "/signup", link: "가입 유형 보기" },
  { category: "PARTNERSHIP", question: "운영 중인 창고(스튜디오)를 제휴하고 싶어요.", answer: "스토리지마켓의 창고 · 스튜디오 · 쇼룸은 본사가 직접 운영하거나 직접 관리할 수 있는 제휴 창고만 씁니다. 제휴를 원하시면 고객 문의로 남겨 주세요. 별도 계정 가입은 없습니다.", href: "/support", link: "제휴 문의하기" },
] satisfies { category: SupportCategory; question: string; answer: string; href: string; link: string }[];
