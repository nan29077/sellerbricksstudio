// PaymentAdapter: PG 교체 가능한 어댑터 구조. 키 없으면 Mock 동작.
import { createHmac, timingSafeEqual } from "crypto";
import { PaymentMethod } from "@prisma/client";

// 웹훅 서명 검증: 본문을 PAYMENT_WEBHOOK_SECRET 으로 HMAC-SHA256 한 hex 값과 비교한다.
// 비밀키가 없으면 개발 환경에서만 통과시키고, 배포 환경에서는 항상 거절한다.
export function verifyHmacSignature(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signature.replace(/^sha256=/, "").trim();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export interface CreatePaymentInput {
  orderId: string; amount: number; method: PaymentMethod; orderName: string;
  buyerName: string; buyerPhone: string;
}
export interface PaymentResult {
  success: boolean; pgTransactionId?: string; approvedAt?: Date; status: string; failReason?: string;
  redirectUrl?: string;
}

export interface PaymentAdapter {
  readonly provider: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  confirmPayment(pgTransactionId: string, amount: number): Promise<PaymentResult>;
  cancelPayment(pgTransactionId: string, reason?: string): Promise<PaymentResult>;
  refundPayment(pgTransactionId: string, amount: number, reason?: string): Promise<PaymentResult>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

export class MockPaymentAdapter implements PaymentAdapter {
  readonly provider = "mock";
  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    return { success: true, pgTransactionId: `mock_${input.orderId}_${Date.now()}`, status: "IN_PROGRESS" };
  }
  async confirmPayment(pgTransactionId: string): Promise<PaymentResult> {
    // Mock: 항상 승인
    return { success: true, pgTransactionId, approvedAt: new Date(), status: "PAID" };
  }
  async cancelPayment(pgTransactionId: string): Promise<PaymentResult> {
    return { success: true, pgTransactionId, status: "CANCELLED" };
  }
  async refundPayment(pgTransactionId: string): Promise<PaymentResult> {
    return { success: true, pgTransactionId, status: "REFUNDED" };
  }
  verifyWebhook(rawBody: string, signature: string | null): boolean {
    return verifyHmacSignature(rawBody, signature, process.env.PAYMENT_WEBHOOK_SECRET);
  }
}

// 실제 PG 어댑터 예시 골격 (TODO: 실제 연동 시 구현)
// export class TossPaymentAdapter implements PaymentAdapter { ... }

export function getPaymentAdapter(): PaymentAdapter {
  const provider = (process.env.PAYMENT_PROVIDER || "mock").trim().toLowerCase();
  switch (provider) {
    // case "toss": return new TossPaymentAdapter();
    case "mock": return new MockPaymentAdapter();
    default: return new UnavailablePaymentAdapter(provider);
  }
}

// 설정은 됐지만 아직 구현되지 않은 결제사: 모든 결제·취소를 실패로 돌려 "돈 없이 결제 완료"가 생기지 않게 한다.
class UnavailablePaymentAdapter implements PaymentAdapter {
  constructor(readonly provider: string) {}
  private fail(): PaymentResult { return { success: false, status: "FAILED", failReason: `결제사(${this.provider}) 연동이 아직 준비되지 않았습니다.` }; }
  async createPayment() { return this.fail(); }
  async confirmPayment() { return this.fail(); }
  async cancelPayment() { return this.fail(); }
  async refundPayment() { return this.fail(); }
  verifyWebhook() { return false; }
}

// 배포 환경에서 실제 PG 없이 Mock 결제가 돌면 누구나 "결제 완료" 주문을 만들 수 있다.
// 실제 PG 를 연동하기 전까지는 배포 환경에서 결제를 막는다. (시연이 필요하면 ALLOW_MOCK_PAYMENT=true)
// 실제로 구현된 결제 어댑터. (여기에 없는 값을 PAYMENT_PROVIDER 에 넣으면 결제를 막는다 — Mock 으로 조용히 돌지 않게)
export const IMPLEMENTED_PROVIDERS = ["mock"] as const;

export function paymentBlockedReason(): string | null {
  const provider = (process.env.PAYMENT_PROVIDER || "mock").trim().toLowerCase();
  if (!(IMPLEMENTED_PROVIDERS as readonly string[]).includes(provider)) {
    console.error(`[payment] PAYMENT_PROVIDER=${provider} 어댑터가 아직 구현되지 않아 결제를 막았습니다.`);
    return "결제 시스템 연동 준비 중입니다. 잠시 후 다시 이용해 주세요.";
  }
  if (provider === "mock" && process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENT !== "true") {
    return "결제 시스템 연동 준비 중입니다. 잠시 후 다시 이용해 주세요.";
  }
  return null;
}
