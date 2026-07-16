// PaymentAdapter: PG 교체 가능한 어댑터 구조. 키 없으면 Mock 동작.
import { PaymentMethod } from "@prisma/client";

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
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) return true; // mock: 검증 통과
    return signature === secret; // 실제 구현에서는 HMAC 검증으로 교체
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
