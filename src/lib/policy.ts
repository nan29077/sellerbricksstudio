import type { PlatformPolicy, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// 플랫폼 운영 정책 (수수료 · 예약 자동화 · 샘플 한도). 최고관리자만 수정한다.
export const POLICY_DEFAULTS = {
  salesFeeRate: 5, brandFeeRate: 5, sampleFeeRate: 0, sellerShareRate: 70,
  pendingExpireHours: 48, noShowGraceMinutes: 30, autoCompleteBookings: true as boolean, reminderHoursBefore: 24,
  poConfirmHours: 24, sampleMaxPerOrder: 20,
  orderAfterEndHours: 0, liveAutoEndHours: 2, settleAfterDays: 7, piiRetentionDays: 90,
  requireEmailVerify: false as boolean, maxPendingBookings: 10,
  requestReplyHours: 72, requestAutoRejectHours: 72,
  sheetShippingFee: 3000,
} satisfies Omit<PlatformPolicy, "id" | "updatedBy" | "updatedAt">;

export type Policy = typeof POLICY_DEFAULTS;

let cache: { at: number; value: Policy } | null = null;

export async function getPolicy(db: Prisma.TransactionClient | typeof prisma = prisma): Promise<Policy> {
  if (cache && Date.now() - cache.at < 10_000 && db === prisma) return cache.value;
  try {
    const row = await db.platformPolicy.findUnique({ where: { id: "default" } });
    const { id: _id, updatedBy: _by, updatedAt: _at, ...rest } = row ?? ({} as PlatformPolicy);
    const value = { ...POLICY_DEFAULTS, ...(row ? rest : {}) } as Policy;
    if (db === prisma) cache = { at: Date.now(), value };
    return value;
  } catch {
    return { ...POLICY_DEFAULTS };
  }
}

export async function savePolicy(patch: Partial<Policy>, updatedBy: string) {
  const data = { ...patch, updatedBy };
  const row = await prisma.platformPolicy.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  cache = null;
  return row;
}

// 브랜드 수수료율: 브랜드별 값이 있으면 우선
export function brandFeeRateOf(policy: Policy, shopFeeRate: number | null | undefined) {
  return typeof shopFeeRate === "number" && Number.isFinite(shopFeeRate) ? shopFeeRate : policy.brandFeeRate;
}

export const pct = (amount: number, rate: number) => Math.round((amount * rate) / 100);
