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
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";
  switch (provider) {
    // case "toss": return new TossPaymentAdapter();
    default: return new MockPaymentAdapter();
  }
}
