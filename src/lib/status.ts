export const BOOKING_STATUS: Record<string, { label: string; tone: "yellow" | "green" | "red" | "gray" | "blue" }> = {
  PENDING: { label: "승인 대기", tone: "yellow" },
  APPROVED: { label: "승인됨", tone: "green" },
  REJECTED: { label: "거절됨", tone: "red" },
  CANCELLED: { label: "취소됨", tone: "gray" },
  COMPLETED: { label: "완료", tone: "blue" },
  NO_SHOW: { label: "노쇼", tone: "red" },
};

export const LIVE_STATUS: Record<string, { label: string; tone: "gray" | "blue" | "red" | "green" | "yellow" }> = {
  DRAFT: { label: "준비중", tone: "gray" },
  READY: { label: "대기", tone: "blue" },
  LIVE: { label: "방송중", tone: "red" },
  ENDED: { label: "종료", tone: "gray" },
  CANCELLED: { label: "취소", tone: "gray" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: "yellow" | "green" | "blue" | "gray" | "red" }> = {
  ORDER_CREATED: { label: "주문생성", tone: "gray" },
  PAYMENT_PENDING: { label: "결제대기", tone: "yellow" },
  PAID: { label: "결제완료", tone: "green" },
  PREPARING: { label: "준비중", tone: "blue" },
  SHIPPED: { label: "배송중", tone: "blue" },
  DELIVERED: { label: "배송완료", tone: "green" },
  CANCELLED: { label: "취소", tone: "gray" },
  REFUNDED: { label: "환불", tone: "red" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: "yellow" | "green" | "red" | "gray" }> = {
  READY: { label: "준비", tone: "gray" },
  IN_PROGRESS: { label: "진행중", tone: "yellow" },
  PAID: { label: "결제완료", tone: "green" },
  FAILED: { label: "실패", tone: "red" },
  CANCELLED: { label: "취소", tone: "gray" },
  REFUNDED: { label: "환불", tone: "red" },
};

export const PAYMENT_METHOD: Record<string, string> = {
  CARD: "신용카드", EASY_PAY: "간편결제", BANK_TRANSFER: "간편 계좌이체",
};

// 주문 처리 흐름: 각 상태에서 다음으로 바꿀 수 있는 상태
export const ORDER_NEXT_STATUS: Record<string, string[]> = {
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
};

export const SETTLEMENT_STATUS: Record<string, { label: string; tone: "yellow" | "blue" | "green" }> = {
  PENDING: { label: "정산 대기", tone: "yellow" }, CONFIRMED: { label: "지급 예정", tone: "blue" }, PAID: { label: "지급 완료", tone: "green" },
};

// 창고(스튜디오) — 외부 창고 계정은 없고 본사가 운영한다. PENDING 은 '비공개(준비 중)'
export const FACILITY_TYPE_LABEL: Record<string, string> = { WAREHOUSE: "창고", STUDIO: "스튜디오", SHOWROOM: "쇼룸" };
export const facilityTypeLabel = (type: string | null | undefined) => FACILITY_TYPE_LABEL[type ?? ""] ?? "창고";
export const facilityTypeTone = (type: string | null | undefined): "blue" | "purple" | "green" =>
  type === "WAREHOUSE" ? "blue" : type === "SHOWROOM" ? "green" : "purple";
export const FACILITY_STATUS_LABEL: Record<string, string> = { PENDING: "비공개(준비 중)", APPROVED: "공개", SUSPENDED: "운영 정지" };
export const FACILITY_OPERATION_LABEL: Record<string, string> = { DIRECT: "직영", PARTNER: "제휴 (직접 관리)" };
