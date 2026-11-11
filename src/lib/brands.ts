import type { BrandRequestKind, BrandRequestStatus, BrandShopStatus, Role } from "@prisma/client";
import { BRAND_ARTWORK } from "./shop-artwork";

export const BRAND_CATEGORIES = ["코스메틱", "의류", "패션잡화", "식품", "홈리빙", "디지털", "스포츠", "반려동물", "기타"] as const;
export const BRAND_SHOP_STATUS: Record<BrandShopStatus, string> = {
  PENDING: "승인 대기", APPROVED: "공개 중", SUSPENDED: "공개 중지",
};
export const BRAND_REQUEST_STATUS: Record<BrandRequestStatus, string> = {
  PENDING: "검토 중", AWAITING_PAYMENT: "입금 대기", APPROVED: "배송 준비",
  SHIPPED: "배송 중", COMPLETED: "완료", REJECTED: "반려", CANCELLED: "취소", REFUNDED: "환불 완료",
};
export const BRAND_REQUEST_KIND: Record<BrandRequestKind, string> = {
  SUPPLY: "공급 신청", SAMPLE: "샘플 주문",
};
export const BRAND_BUYER_ROLES: Role[] = ["SELLER", "FACILITY_ADMIN"];

export function brandArtworkFor(category: string) {
  const index = BRAND_CATEGORIES.findIndex((name) => name === category);
  return BRAND_ARTWORK[index >= 0 && index < 4 ? index : 4].url;
}

type RequestState = { status: BrandRequestStatus; kind: BrandRequestKind; unitPrice: number };

export function brandRequestActions(request: RequestState, manager: boolean): BrandRequestStatus[] {
  const paidSample = request.kind === "SAMPLE" && request.unitPrice > 0;
  if (!manager) {
    if (request.status === "AWAITING_PAYMENT" || request.status === "PENDING") return ["CANCELLED"];
    if (request.status === "SHIPPED") return ["COMPLETED"];
    return [];
  }
  switch (request.status) {
    case "PENDING": return ["APPROVED", "REJECTED"];
    case "AWAITING_PAYMENT": return ["APPROVED", "CANCELLED"];
    case "APPROVED": return ["SHIPPED", paidSample ? "REFUNDED" : "CANCELLED"];
    case "SHIPPED": return ["COMPLETED"];
    default: return [];
  }
}
