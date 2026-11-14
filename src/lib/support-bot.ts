import type { SupportCategory } from "@prisma/client";
import { supportFaq } from "./support";

// ---------------------------------------------------------------------------
// 스토리지마켓 상담 챗봇 (2026-11-14)
//  외부 AI 없이 동작하는 의도(intent) 매칭 챗봇. 질문을 정리해 키워드 · 비슷한 표현 점수로 가장 맞는 답을 고르고,
//  로그인한 회원에게는 내 예약 · 주문서 · 문의 상태를 바로 알려 준다. 해결이 안 되면 1:1 문의로 대화 기록과 함께 넘긴다.
// ---------------------------------------------------------------------------

export type BotLink = { label: string; href: string };
export type BotReply = {
  text: string; links?: BotLink[]; chips?: string[];
  intent: string; confident: boolean;
  handoff?: { category: SupportCategory; subject: string }; // '상담원에게 문의 남기기' 미리 채움
  personal?: "MY_BOOKINGS" | "MY_SHEETS" | "MY_INQUIRIES"; // API 에서 회원 정보로 채운다
};
type Role = string | null | undefined;
type Intent = {
  id: string; keywords: string[]; strong?: string[]; // strong: 한 단어만 맞아도 확실한 표현
  answer: (role: Role) => Omit<BotReply, "intent" | "confident">;
};

const START_CHIPS = ["공간 예약 방법", "시연품은 어떻게 준비돼요?", "주문서 쓰는 법", "정산은 언제?", "상담원 연결"];

const INTENTS: Intent[] = [
  {
    id: "greeting", keywords: ["안녕", "하이", "hello", "hi", "반가", "처음"],
    answer: () => ({ text: "안녕하세요! 스토리지마켓 상담 챗봇이에요. 공간 예약 · 브랜드 상품 · 주문서 · 정산 등 궁금한 걸 편하게 물어보세요.", chips: START_CHIPS }),
  },
  {
    id: "booking_how", keywords: ["예약", "공간", "창고", "스튜디오", "쇼룸", "대여", "빌리", "장소"], strong: ["예약방법", "공간예약", "어떻게예약"],
    answer: (role) => ({
      text: "셀러는 ① 브랜드 상품을 고르고 ② 창고 · 스튜디오 · 쇼룸을 골라 ③ 날짜만 예약하면 돼요. 공간 이용료는 무료이고, 예약이 확정되면 담은 브랜드 상품의 시연품이 방송 2일 전까지 그 공간으로 준비돼요.",
      links: role === "SELLER" ? [{ label: "방송 공간 예약하기", href: "/seller/bookings/new" }, { label: "내 예약 보기", href: "/seller/bookings" }] : [{ label: "공간 둘러보기", href: "/facilities" }, { label: "셀러 가입", href: "/signup/seller" }],
      chips: ["시연품은 어떻게 준비돼요?", "예약 취소 · 변경", "이용료가 있나요?"],
    }),
  },
  {
    id: "booking_change", keywords: ["취소", "변경", "일정", "바꾸", "미루", "환불"], strong: ["예약취소", "예약변경", "일정변경"],
    answer: (role) => ({
      text: "예약은 이용 시작 전 공간별 마감 시간(보통 24시간 전)까지 예약 관리에서 직접 취소하거나 일정을 바꿀 수 있어요. 확정된 예약의 일정을 바꾸면 다시 승인 대기가 될 수 있고, 담은 브랜드 시연품의 도착 기한도 새 일정에 맞춰 자동으로 안내돼요.",
      links: role === "SELLER" ? [{ label: "내 예약 관리", href: "/seller/bookings" }] : [{ label: "로그인", href: "/login" }],
      chips: ["내 예약 확인", "상담원 연결"],
    }),
  },
  {
    id: "display", keywords: ["시연품", "시연", "샘플도착", "미리", "준비", "도착", "상품준비"], strong: ["시연품"],
    answer: () => ({
      text: "예약할 때 '내가 고른 브랜드 상품'을 담으면, 예약이 확정되는 순간 브랜드에 방송 시연품 요청이 자동으로 가요. 브랜드는 방송 2일 전까지 그 공간으로 보내고, 공간 운영팀이 도착을 확인해요. 준비 현황(브랜드 확인 · 배송 중 · 도착)은 예약 관리에서 볼 수 있고, 하루 전까지 도착하지 않으면 알림으로 알려 드려요. 시연품은 브랜드 무료 제공이 원칙이에요.",
      links: [{ label: "내 예약에서 준비 현황 보기", href: "/seller/bookings" }],
      chips: ["브랜드 상품 고르기", "공간 예약 방법"],
    }),
  },
  {
    id: "brand_pick", keywords: ["브랜드", "상품고르", "고르", "가져오", "위탁배송", "공급가", "판매상품", "상품선택"], strong: ["브랜드상품"],
    answer: (role) => ({
      text: "브랜드샵에서 마음에 드는 상품을 '판매 상품으로 가져오기'로 고르면 내 판매 상품에 담겨요. 공급가를 보고 내 판매가를 정하고, 예약할 때 방송 상품으로 담거나 판매 후 주문서에 담으면 돼요.",
      links: [{ label: "브랜드샵 둘러보기", href: "/brands" }, ...(role === "SELLER" ? [{ label: "내 브랜드 판매 상품", href: "/seller/brand-products" }] : [])],
      chips: ["샘플 신청", "주문서 쓰는 법"],
    }),
  },
  {
    id: "sample", keywords: ["샘플", "써보", "체험"], strong: ["샘플신청"],
    answer: () => ({
      text: "샘플이 있는 상품은 브랜드샵 상품 카드의 '샘플 신청'으로 받아 볼 수 있어요. 무료 샘플과 유료 샘플이 있고, 유료 샘플은 신청할 때 결제되며 브랜드가 반려하면 자동 환불돼요.",
      links: [{ label: "샘플 가능한 브랜드", href: "/brands?sample=1" }, { label: "내 샘플 신청", href: "/brand-requests" }],
    }),
  },
  {
    id: "sheet", keywords: ["주문서", "발주", "엑셀", "업로드", "판매한주문", "주문넣", "주문등록", "외부플랫폼"], strong: ["주문서"],
    answer: (role) => ({
      text: "외부 라이브 플랫폼에서 판 주문은 주문서로 내요. 화면에서 직접 쓰거나 엑셀 양식으로 한 번에 올릴 수 있고, 공급가(스토리지마켓 출고 상품은 배송비 포함)를 결제하면 브랜드 · 스토리지마켓이 받는 분에게 바로 보내요. 구매자가 스토리지마켓에서 직접 주문하는 기능은 없어요.",
      links: role === "SELLER" ? [{ label: "주문서 작성", href: "/seller/orders/new" }, { label: "주문서 · 배송 현황", href: "/seller/orders" }] : [{ label: "셀러 가입", href: "/signup/seller" }],
      chips: ["배송 조회", "주문서 취소"],
    }),
  },
  {
    id: "sheet_cancel", keywords: ["주문취소", "주문서취소", "취소하고", "잘못보냈", "잘못넣"], strong: ["주문서취소"],
    answer: () => ({
      text: "출고 전 주문서는 주문서 · 배송 현황에서 바로 취소할 수 있고, 결제한 공급가는 환불돼요. 이미 출고된 뒤에는 반품 · 환불을 운영팀이 도와드려요.",
      links: [{ label: "주문서 · 배송 현황", href: "/seller/orders" }], chips: ["상담원 연결"],
      handoff: { category: "ORDER_PAYMENT", subject: "주문서 취소 · 환불 문의" },
    }),
  },
  {
    id: "delivery", keywords: ["배송", "운송장", "택배", "언제와", "도착안", "출고", "배송조회"], strong: ["배송조회", "운송장"],
    answer: (role) => ({
      text: "주문서 · 배송 현황에서 주문서별 출고 상태와 운송장을 확인할 수 있어요. 위탁배송 상품은 브랜드가, 스토리지마켓 입고 상품은 스토리지마켓 창고가 보내요.",
      links: role === "SELLER" ? [{ label: "주문서 · 배송 현황", href: "/seller/orders" }] : role === "BRAND_ADMIN" ? [{ label: "발주서", href: "/brand/orders" }] : [{ label: "로그인", href: "/login" }],
      chips: ["내 주문서 확인", "상담원 연결"],
    }),
  },
  {
    id: "payment", keywords: ["결제", "카드", "간편결제", "계좌", "입금", "결제수단"], strong: ["결제방법"],
    answer: () => ({
      text: "주문서를 낼 때 카드 · 간편결제 · 계좌이체로 공급가를 결제해요. 출고 전에 취소하면 결제가 취소되고, 출고 후 반품은 운영팀 확인 뒤 환불돼요.",
      chips: ["주문서 취소", "정산은 언제?"],
    }),
  },
  {
    id: "settlement", keywords: ["정산", "수수료", "지급", "입금일", "정산일", "돈"], strong: ["정산"],
    answer: (role) => ({
      text: role === "BRAND_ADMIN"
        ? "브랜드 공급대금은 배송 완료 후 정산 확정 유예 기간이 지나면 정산 대상이 되고, 브랜드 수수료를 뺀 금액을 등록한 계좌로 보내 드려요. 정산 메뉴에서 명세를 내려받을 수 있어요."
        : "셀러는 주문서마다 공급가를 결제하고, 외부 플랫폼 판매가와의 차이가 셀러 몫이에요. 결제 · 환불 내역은 결제 · 정산 내역에서 확인해요. 브랜드는 배송 완료 후 정산돼요.",
      links: role === "BRAND_ADMIN" ? [{ label: "브랜드 정산", href: "/brand/settlements" }] : role === "SELLER" ? [{ label: "결제 · 정산 내역", href: "/seller/settlements" }] : [{ label: "수수료 정책 안내", href: "/intro" }],
      handoff: { category: "SETTLEMENT", subject: "정산 문의" },
    }),
  },
  {
    id: "platform", keywords: ["플랫폼", "셀러브릭스", "그립", "클릭메이트", "바이브", "모루라이브", "유튜브", "틱톡", "인스타", "네이버"], strong: ["판매플랫폼"],
    answer: (role) => ({
      text: "셀러는 쓰는 라이브 플랫폼(셀러브릭스 · 클릭메이트 · 그립 · 바이브 · 모루라이브 · 유튜브 · 틱톡 · 인스타그램 등)에서 판매하고, 판매분은 주문서로 내면 돼요. 쓰는 플랫폼은 가입할 때와 설정에서 바꿀 수 있어요.",
      links: role === "SELLER" ? [{ label: "설정에서 판매 플랫폼 바꾸기", href: "/seller/settings" }] : [],
    }),
  },
  {
    id: "fee", keywords: ["이용료", "비용", "무료", "가격", "얼마", "요금"], strong: ["이용료"],
    answer: () => ({ text: "창고 · 스튜디오 · 쇼룸 이용료는 무료예요. 셀러는 판매한 주문서의 공급가(스토리지마켓 출고 시 배송비 포함)만 결제해요.", chips: ["공간 예약 방법", "주문서 쓰는 법"] }),
  },
  {
    id: "account", keywords: ["가입", "회원", "로그인", "비밀번호", "아이디", "계정", "탈퇴", "이메일인증"], strong: ["비밀번호", "회원가입"],
    answer: () => ({
      text: "셀러는 판매 플랫폼을 골라 가입하고, 상품을 공급하려면 브랜드사로 가입해요. 비밀번호를 잊었다면 로그인 화면의 '비밀번호 찾기'로 재설정 메일을 받을 수 있어요. 창고 · 스튜디오 · 쇼룸은 스토리지마켓이 직접 운영해서 따로 가입하지 않아요.",
      links: [{ label: "회원가입", href: "/signup" }, { label: "비밀번호 찾기", href: "/forgot-password" }],
      handoff: { category: "ACCOUNT", subject: "계정 · 가입 문의" },
    }),
  },
  {
    id: "brand_join", keywords: ["입점", "브랜드사", "상품등록", "공급", "위탁배송설정", "배송방식"], strong: ["입점"],
    answer: (role) => ({
      text: "브랜드사로 가입하면 브랜드샵이 만들어지고, 상품마다 공급가 · 옵션 · 배송 방식(위탁배송 · 스토리지마켓 입고)을 정해 등록해요. 승인 후 셀러가 상품을 골라 방송하면 발주서와 시연품 요청이 브랜드로 들어와요.",
      links: role === "BRAND_ADMIN" ? [{ label: "상품 · 재고 관리", href: "/brand/products" }] : [{ label: "브랜드사 가입", href: "/signup/brand" }],
      handoff: { category: "PARTNERSHIP", subject: "브랜드 입점 문의" },
    }),
  },
  {
    id: "partnership", keywords: ["제휴", "창고운영", "공간등록", "협업", "파트너", "광고"], strong: ["제휴문의"],
    answer: () => ({
      text: "스토리지마켓은 직접 운영하거나 직접 관리할 수 있는 제휴 공간만 써요. 공간 제휴 · 협업은 1:1 문의로 남겨 주시면 담당자가 연락드려요.",
      handoff: { category: "PARTNERSHIP", subject: "공간 제휴 · 협업 문의" }, chips: ["상담원 연결"],
    }),
  },
  {
    id: "contact", keywords: ["전화", "연락처", "운영시간", "상담시간", "몇시"],
    answer: () => ({ text: "운영팀은 평일 10:00~18:00에 1:1 문의를 순서대로 확인해요. 문의를 남기면 답변이 등록될 때 알림(비회원은 이메일)으로 알려 드려요.", chips: ["상담원 연결"] }),
  },
  { id: "my_bookings", keywords: ["내예약", "예약확인", "다음예약", "예약상태", "예약현황"], strong: ["내예약", "예약확인"], answer: () => ({ text: "", personal: "MY_BOOKINGS" }) },
  { id: "my_sheets", keywords: ["내주문", "주문현황", "주문서상태", "주문서현황", "내주문서"], strong: ["내주문서", "내주문"], answer: () => ({ text: "", personal: "MY_SHEETS" }) },
  { id: "my_inquiries", keywords: ["내문의", "문의답변", "답변왔", "문의확인"], strong: ["내문의"], answer: () => ({ text: "", personal: "MY_INQUIRIES" }) },
  {
    id: "human", keywords: ["상담원", "사람", "직원", "담당자", "문의남기", "1:1", "일대일", "연결", "직접문의", "상담"], strong: ["상담원", "상담원연결"],
    answer: () => ({ text: "운영팀에 1:1 문의를 남겨 주세요. 지금까지 챗봇과 나눈 대화도 함께 전달돼서 처음부터 다시 설명하지 않아도 돼요.", handoff: { category: "OTHER", subject: "상담원 문의" } }),
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s·,.!?~'"()[\]{}:;/\\-]+/g, "");
const bigrams = (s: string) => { const n = norm(s); const out = new Set<string>(); for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2)); return out; };
const sim = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let c = 0; a.forEach((x) => { if (b.has(x)) c++; }); return c / Math.min(a.size, b.size); };

/** 질문에 가장 맞는 답을 고른다 */
export function answer(message: string, role: Role): BotReply {
  const q = norm(message);
  if (!q) return { intent: "empty", confident: false, text: "궁금한 내용을 적어 주세요.", chips: START_CHIPS };
  let best: { intent: Intent; score: number } | null = null;
  for (const it of INTENTS) {
    let score = 0;
    for (const k of it.strong ?? []) if (q.includes(norm(k))) score += 6;
    for (const k of it.keywords) if (q.includes(norm(k))) score += 1 + Math.min(2, norm(k).length / 3);
    if (!best || score > best.score) best = { intent: it, score };
  }
  // FAQ 와 비슷한 질문이면 FAQ 답변도 후보로
  const qb = bigrams(message);
  let faq: { item: (typeof supportFaq)[number]; score: number } | null = null;
  for (const item of supportFaq) { const s = sim(qb, bigrams(item.question)); if (!faq || s > faq.score) faq = { item, score: s }; }
  if (faq && faq.score >= 0.6 && (!best || best.score < 3)) {
    return { intent: "faq", confident: true, text: faq.item.answer, links: [{ label: faq.item.link, href: faq.item.href }], chips: ["상담원 연결"] };
  }
  if (!best || best.score < 1.5) {
    return {
      intent: "unknown", confident: false,
      text: "질문을 정확히 이해하지 못했어요. 아래에서 가까운 주제를 고르거나, 운영팀에 1:1 문의를 남겨 주세요.",
      chips: START_CHIPS, handoff: { category: "OTHER", subject: message.trim().slice(0, 60) || "기타 문의" },
    };
  }
  return { intent: best.intent.id, confident: best.score >= 3, ...best.intent.answer(role) };
}

export const BOT_WELCOME: BotReply = {
  intent: "welcome", confident: true,
  text: "안녕하세요, 스토리지마켓 상담 챗봇이에요. 무엇을 도와드릴까요? 아래에서 고르거나 질문을 입력해 주세요.",
  chips: START_CHIPS,
};
