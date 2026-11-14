import type { BrandRequestKind, BrandRequestStatus, BrandShopStatus, FulfillmentMode, Prisma, PurchaseOrderStatus, Role } from "@prisma/client";
import { BRAND_ARTWORK } from "./shop-artwork";
import { CATEGORIES, normalizeCategory } from "./categories";

// 브랜드 카테고리 = 공통 카테고리
export const BRAND_CATEGORIES = CATEGORIES;
export const PUBLIC_BRAND_SHOP = { status: "APPROVED", owner: { isActive: true, role: "BRAND_ADMIN" } } satisfies Prisma.BrandShopWhereInput;
export const BRAND_SHOP_STATUS: Record<BrandShopStatus, string> = {
  PENDING: "승인 대기", APPROVED: "공개 중", SUSPENDED: "공개 중지",
};
export const BRAND_REQUEST_STATUS: Record<BrandRequestStatus, string> = {
  PENDING: "검토 중", AWAITING_PAYMENT: "입금 대기", APPROVED: "배송 준비",
  SHIPPED: "배송 중", COMPLETED: "완료", REJECTED: "반려", CANCELLED: "취소", REFUNDED: "환불 완료",
};
export const BRAND_REQUEST_KIND: Record<BrandRequestKind, string> = {
  SUPPLY: "창고 입고 요청", SAMPLE: "샘플 주문",
};
// 브랜드 상품을 가져가 파는 판매처: 셀러, 그리고 스토리지마켓 창고를 대신하는 최고관리자(본사)
export const BRAND_BUYER_ROLES: Role[] = ["SELLER", "SUPER_ADMIN"];

/**
 * 브랜드 공급가·재고·최저 판매가를 볼 수 있는 계정인지.
 * 공급가는 거래 파트너(셀러·창고)와 최고관리자에게만 공개하고, 비로그인·구매자·다른 브랜드에는 숨긴다.
 * (자기 브랜드샵은 각 화면에서 isMine 으로 따로 허용)
 */
export function canSeeSupplyPrice(role?: Role | null) {
  return !!role && (BRAND_BUYER_ROLES.includes(role) || role === "SUPER_ADMIN");
}
export const SUPPLY_PRICE_HIDDEN_NOTE = "공급가는 셀러·창고(스튜디오) 계정으로 로그인하면 볼 수 있습니다";

export function brandProductHref(shopId: string, productId: string) {
  return `/brands/${shopId}?product=${encodeURIComponent(productId)}#shop-products`;
}

export function brandArtworkFor(category: string) {
  const main = normalizeCategory(category);
  const index = main === "코스메틱" ? 0 : main === "의류" ? 1 : main === "패션잡화" || main === "주얼리·시계" ? 2 : main === "식품" || main === "농수산물" || main === "건강식품" ? 3 : 4;
  return BRAND_ARTWORK[index].url;
}

export const FULFILLMENT_LABEL: Record<FulfillmentMode, string> = {
  DROPSHIP: "브랜드 직배송", WAREHOUSE: "창고 입고(위탁)",
};
export const FULFILLMENT_DESC: Record<FulfillmentMode, string> = {
  DROPSHIP: "판매되면 발주서가 브랜드사로 전달되고, 브랜드사가 구매자에게 직접 배송합니다.",
  WAREHOUSE: "브랜드사가 창고에 미리 입고하고, 창고가 구매자에게 출고합니다. 판매분은 정산용 발주서로 브랜드사에 전달됩니다.",
};

export const PO_STATUS: Record<PurchaseOrderStatus, { label: string; tone: "yellow" | "blue" | "green" | "gray" | "red" }> = {
  NEW: { label: "신규 발주", tone: "yellow" },
  CONFIRMED: { label: "발주 확인", tone: "blue" },
  SHIPPED: { label: "배송 중", tone: "blue" },
  DELIVERED: { label: "배송 완료", tone: "green" },
  CANCELLED: { label: "취소", tone: "gray" },
  RETURNED: { label: "반품·환불", tone: "red" },
};

// 발주서 상태 변경 규칙. 창고 입고(위탁) 발주는 창고가 출고하므로 브랜드는 확인만 한다.
export function poActions(po: { status: PurchaseOrderStatus; fulfillment: FulfillmentMode }, actor: "BRAND" | "ADMIN"): PurchaseOrderStatus[] {
  const dropship = po.fulfillment === "DROPSHIP";
  const base: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
    NEW: dropship ? ["CONFIRMED", "SHIPPED"] : ["CONFIRMED"],
    CONFIRMED: dropship ? ["SHIPPED"] : [],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
    RETURNED: [],
  };
  const list = [...base[po.status]];
  if (actor === "ADMIN") {
    if (["NEW", "CONFIRMED"].includes(po.status)) list.push("CANCELLED");
    if (["SHIPPED", "DELIVERED"].includes(po.status)) list.push("RETURNED");
    if (!dropship && po.status === "CONFIRMED") list.push("DELIVERED");
  }
  return Array.from(new Set(list));
}

// 옵션 문자열 "색상:블랙,화이트|사이즈:S,M" ↔ 구조
export type OptionGroup = { name: string; values: string[] };
export function parseOptions(text: string | null | undefined): OptionGroup[] {
  return (text ?? "").split("|").map((part) => {
    const [name, values = ""] = part.split(":");
    return { name: (name ?? "").trim(), values: values.split(",").map((v) => v.trim()).filter(Boolean) };
  }).filter((g) => g.name && g.values.length).slice(0, 3);
}
export function formatOptions(groups: OptionGroup[]): string {
  return groups.filter((g) => g.name.trim() && g.values.length)
    .map((g) => `${g.name.trim().replace(/[:|,]/g, "")}:${g.values.map((v) => v.trim().replace(/[:|,]/g, "")).filter(Boolean).join(",")}`).join("|");
}
// 구매 화면에서 쓰는 옵션 스냅샷(JSON) — 기존 LiveSessionProduct.optionSnapshot 형식
export function optionSnapshotOf(text: string | null | undefined): string | null {
  const groups = parseOptions(text);
  return groups.length ? JSON.stringify(groups) : null;
}

const PO_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function makePoNo(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 3600000);
  const ymd = kst.toISOString().slice(2, 10).replace(/-/g, "");
  let r = "";
  for (let i = 0; i < 6; i++) r += PO_CHARS[Math.floor(Math.random() * PO_CHARS.length)];
  return `PO-${ymd}-${r}`;
}

type RequestState = { status: BrandRequestStatus; kind: BrandRequestKind; unitPrice: number; paymentStatus?: string };

// 신청 상태 변경 규칙.
//  - 유료 샘플은 신청할 때 플랫폼에서 결제되고(paymentStatus=PAID), 반려·취소되면 자동 환불된다.
//  - 예전 계좌이체 방식(AWAITING_PAYMENT)으로 접수된 건은 기존 흐름을 그대로 쓴다.
//  - 창고 입고 요청(SUPPLY)은 창고가 받은 뒤 "완료(입고 확인)"하면 창고 재고가 늘어난다.
export function brandRequestActions(request: RequestState, manager: boolean): BrandRequestStatus[] {
  const legacyPaid = request.kind === "SAMPLE" && request.unitPrice > 0 && request.paymentStatus !== "PAID" && request.paymentStatus !== "REFUNDED";
  if (!manager) {
    if (request.status === "AWAITING_PAYMENT" || request.status === "PENDING") return ["CANCELLED"];
    if (request.status === "SHIPPED") return ["COMPLETED"];
    return [];
  }
  switch (request.status) {
    case "PENDING": return ["APPROVED", "REJECTED"];
    case "AWAITING_PAYMENT": return ["APPROVED", "CANCELLED"];
    case "APPROVED": return ["SHIPPED", legacyPaid ? "REFUNDED" : "CANCELLED"];
    case "SHIPPED": return ["COMPLETED"];
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// 구매자 개인정보 가림: 배송이 끝나고 정책 기간이 지나면 브랜드 화면·CSV 에서 이름 · 연락처 · 주소를 가린다.
// (창고 입고 발주는 받는 곳이 창고라 가리지 않는다)
// ---------------------------------------------------------------------------
export function piiExpired(po: { fulfillment: FulfillmentMode; deliveredAt: Date | null; cancelledAt: Date | null }, days: number, now = Date.now()) {
  if (po.fulfillment !== "DROPSHIP") return false;
  const end = po.deliveredAt ?? po.cancelledAt;
  return !!end && now - end.getTime() > days * 86400000;
}
export const maskName = (v: string) => (v.length <= 1 ? "*" : `${v[0]}${"*".repeat(Math.max(1, v.length - 2))}${v.length > 2 ? v[v.length - 1] : ""}`);
export const maskPhone = (v: string) => v.replace(/\d(?=(?:\D*\d){4})/g, "*");
export const maskAddress = (v: string) => (v ? `${v.split(/\s+/).slice(0, 2).join(" ")} ***` : "");
