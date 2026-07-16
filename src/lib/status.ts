export const BOOKING_STATUS: Record<string, { label: string; tone: "yellow" | "green" | "red" | "gray" | "blue" }> = {
  PENDING: { label: "승인 대기", tone: "yellow" },
  APPROVED: { label: "승인됨", tone: "green" },
  REJECTED: { label: "거절됨", tone: "red" },
  CANCELLED: { label: "취소됨", tone: "gray" },
  COMPLETED: { label: "완료", tone: "blue" },
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
