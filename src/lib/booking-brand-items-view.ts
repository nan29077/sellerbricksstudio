import type { BrandRequestStatus } from "@prisma/client";

/** 준비 상태 (연결된 시연품 요청의 상태로 판단) */
export function displayState(status: BrandRequestStatus | null | undefined): { key: "WAITING" | "REQUESTED" | "PREPARING" | "SHIPPING" | "ARRIVED" | "UNAVAILABLE"; label: string } {
  switch (status) {
    case undefined: case null: return { key: "WAITING", label: "예약 승인 후 요청" };
    case "PENDING": return { key: "REQUESTED", label: "브랜드 확인 중" };
    case "APPROVED": case "AWAITING_PAYMENT": return { key: "PREPARING", label: "발송 준비" };
    case "SHIPPED": return { key: "SHIPPING", label: "배송 중" };
    case "COMPLETED": return { key: "ARRIVED", label: "도착 완료" };
    default: return { key: "UNAVAILABLE", label: "준비 불가" };
  }
}

