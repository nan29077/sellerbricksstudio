export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { getPolicy, savePolicy } from "@/lib/policy";

const rate = z.coerce.number().min(0).max(100);
const schema = z.object({
  salesFeeRate: rate, brandFeeRate: rate, sampleFeeRate: rate, sellerShareRate: rate,
  pendingExpireHours: z.coerce.number().int().min(0).max(24 * 30),
  noShowGraceMinutes: z.coerce.number().int().min(0).max(24 * 60),
  autoCompleteBookings: z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean()),
  reminderHoursBefore: z.coerce.number().int().min(0).max(24 * 7),
  poConfirmHours: z.coerce.number().int().min(1).max(24 * 14),
  sampleMaxPerOrder: z.coerce.number().int().min(1).max(1000),
  orderAfterEndHours: z.coerce.number().int().min(0).max(24 * 30),
  settleAfterDays: z.coerce.number().int().min(0).max(60),
  piiRetentionDays: z.coerce.number().int().min(7).max(3650),
  requireEmailVerify: z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean()),
  maxPendingBookings: z.coerce.number().int().min(0).max(100),
}).partial();

export async function GET() {
  try { await requireRole(["SUPER_ADMIN"]); return ok(await getPolicy()); } catch (e) { return handleError(e); }
}

// PUT — 최고관리자: 수수료 · 예약 자동화 · 샘플 한도 정책 수정 (다음 계산부터 적용)
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const data = schema.parse(await req.json().catch(() => ({})));
    const before = await getPolicy();
    const row = await savePolicy(data, admin.id);
    await audit({ actorId: admin.id, action: "POLICY_UPDATE", entity: "PlatformPolicy", entityId: row.id, meta: { before, after: data } });
    return ok(row);
  } catch (e) { return handleError(e); }
}
