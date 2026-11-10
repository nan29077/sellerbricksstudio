import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/http";
import { getFacilityWithPolicy, getRangeSummary } from "@/lib/booking";
import { kstStartOfDay, parseDateKey } from "@/lib/kst";
import { policyOf } from "@/lib/booking-engine";

// GET /api/facilities/[id]/calendar?from=YYYY-MM-DD&days=35
// 날짜별 예약 여유(여유 / 마감 임박 / 마감 / 휴무 / 예약 기간 아님) 요약
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const f = await getFacilityWithPolicy(params.id);
    if (!f || f.status !== "APPROVED") return fail("창고(스튜디오)를 찾을 수 없습니다.", 404);
    const from = parseDateKey(req.nextUrl.searchParams.get("from")) ?? kstStartOfDay(new Date());
    const days = Number(req.nextUrl.searchParams.get("days")) || 35;
    const summary = await getRangeSummary(f, from, days);
    return ok({ days: summary, policy: policyOf(f) });
  } catch (e) { return handleError(e); }
}
