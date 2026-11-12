// 셀러 쿠폰 (방송 결제에서 사용)
//  - 방송한 셀러가 만든 쿠폰만 쓸 수 있다. 기간 · 사용 여부 · 남은 수량 · 최소 주문 금액을 확인한다.
//  - 할인은 셀러가 부담한다: 줄마다 셀러 몫에 비례해 나눠 넣고, 셀러 몫을 넘지 않는다.
//    (플랫폼 수수료 · 브랜드 공급대금 · 창고 정산은 그대로)
//  - 결제 실패 · 출고 전 전체 취소면 사용 수량을 되돌린다.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient;
type Coupon = {
  id: string; code: string; name: string; sellerId: string; discountType: "PERCENT" | "FIXED"; discountValue: number;
  minAmount: number; maxDiscount: number | null; totalQty: number | null; usedQty: number; startAt: Date; endAt: Date; isActive: boolean;
};

export const normalizeCouponCode = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase().replace(/\s+/g, "").slice(0, 20) : "");

/** 쿠폰을 쓸 수 없으면 이유, 쓸 수 있으면 null */
export function couponBlockedReason(c: Coupon | null, sellerId: string, subtotal: number, now = new Date()) {
  if (!c || c.sellerId !== sellerId) return "이 방송에서 쓸 수 없는 쿠폰입니다.";
  if (!c.isActive) return "사용이 중지된 쿠폰입니다.";
  if (now < c.startAt) return "아직 사용 기간이 아닌 쿠폰입니다.";
  if (now > c.endAt) return "사용 기간이 지난 쿠폰입니다.";
  if (c.totalQty != null && c.usedQty >= c.totalQty) return "모두 사용된 쿠폰입니다.";
  if (subtotal < c.minAmount) return `${c.minAmount.toLocaleString("ko-KR")}원 이상 주문할 때 쓸 수 있는 쿠폰입니다.`;
  return null;
}

/** 쿠폰 할인 금액 (상품 금액 기준, 배송비 제외). 셀러 몫(sellerCap)을 넘지 않는다. */
export function couponDiscount(c: Pick<Coupon, "discountType" | "discountValue" | "maxDiscount">, subtotal: number, sellerCap: number) {
  let d = c.discountType === "PERCENT" ? Math.floor((subtotal * Math.min(100, Math.max(0, c.discountValue))) / 100) : Math.floor(Math.max(0, c.discountValue));
  if (c.maxDiscount != null && c.maxDiscount > 0) d = Math.min(d, c.maxDiscount);
  return Math.max(0, Math.min(d, subtotal, Math.max(0, sellerCap)));
}

/** 할인을 줄마다 셀러 몫에 비례해 나눈다. 합계는 정확히 discount, 각 줄은 그 줄의 셀러 몫 이하 */
export function allocateDiscount(discount: number, sellerShares: number[]) {
  const total = sellerShares.reduce((s, v) => s + Math.max(0, v), 0);
  const out = sellerShares.map(() => 0);
  if (discount <= 0 || total <= 0) return out;
  const d = Math.min(discount, total);
  let given = 0;
  sellerShares.forEach((v, i) => { out[i] = Math.floor((d * Math.max(0, v)) / total); given += out[i]; });
  // 나머지(반올림 차이)는 여유가 있는 줄부터 1원씩
  for (let i = 0; given < d && i < out.length * 2; i++) {
    const k = i % out.length;
    if (out[k] < Math.max(0, sellerShares[k])) { out[k] += 1; given += 1; }
  }
  return out;
}

export async function findCoupon(code: string) {
  if (!code) return null;
  return prisma.sellerCoupon.findUnique({ where: { code } }) as Promise<Coupon | null>;
}

/** 사용 수량 1 증가 (남은 수량이 있을 때만). 성공하면 true */
export async function claimCouponInTx(tx: Tx, couponId: string) {
  const n = await tx.$executeRaw`UPDATE "SellerCoupon" SET "usedQty" = "usedQty" + 1, "updatedAt" = now()
    WHERE "id" = ${couponId} AND "isActive" = true AND ("totalQty" IS NULL OR "usedQty" < "totalQty")`;
  return n === 1;
}

/** 주문에 쓴 쿠폰의 사용 수량을 되돌린다 (결제 실패 · 출고 전 전체 취소) */
export async function releaseCouponInTx(tx: Tx, orderId: string) {
  const o = await tx.order.findUnique({ where: { id: orderId }, select: { couponId: true } });
  if (!o?.couponId) return;
  await tx.$executeRaw`UPDATE "SellerCoupon" SET "usedQty" = GREATEST("usedQty" - 1, 0), "updatedAt" = now() WHERE "id" = ${o.couponId}`;
  await tx.order.update({ where: { id: orderId }, data: { couponId: null } }); // 두 번 되돌리지 않게 연결을 끊는다 (couponCode 는 기록으로 남김)
}
