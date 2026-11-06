import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { changeBookingStatus } from "@/lib/booking-actions";

// 일괄 처리: { ids: string[], status, reason? } — 건별 결과를 돌려준다.
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    const { ids, status, reason } = await req.json().catch(() => ({}));
    if (!Array.isArray(ids) || ids.length === 0) return fail("처리할 예약을 선택하세요.");
    if (ids.length > 100) return fail("한 번에 100건까지 처리할 수 있습니다.");
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try { await changeBookingStatus(user, String(id), status, reason); results.push({ id, ok: true }); }
      catch (e) { results.push({ id, ok: false, error: e instanceof Error ? e.message : "실패" }); }
    }
    return ok({ success: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) });
  } catch (e) { return handleError(e); }
}
