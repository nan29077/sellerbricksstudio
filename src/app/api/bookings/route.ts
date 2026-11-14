import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth";
import { bookingSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { parseKST } from "@/lib/utils";
import { createBookings } from "@/lib/booking-actions";
import { emailVerifyBlock } from "@/lib/account-guards";

// POST /api/bookings — 셀러 예약 신청
// body: { facilityId, startAt, endAt, purpose?, headcount?, requestNote?, products?: [{facilityProductId, quantity}],
//         repeatWeeks?: 1~12, skipConflicts?: boolean, dryRun?: boolean }
// - 창고(스튜디오) 이용료는 무료입니다.
// - dryRun=true 이면 저장하지 않고 날짜별 예약 가능 여부만 돌려줍니다. (반복 예약 미리보기)
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const blocked = await emailVerifyBlock(user);
    if (blocked) return fail(blocked, 403);
    let data;
    try { data = bookingSchema.parse(await req.json()); }
    catch (e) { return fail(e instanceof ZodError ? e.issues[0]?.message ?? "입력값을 확인하세요." : "입력값을 확인하세요."); }

    // 예약 일시는 항상 KST 기준으로 해석 (서버/사용자 로컬 타임존 무관)
    const startAt = parseKST(data.startAt);
    const endAt = parseKST(data.endAt);
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return fail("예약 시간이 올바르지 않습니다.");
    if (endAt <= startAt) return fail("종료 시간은 시작 시간보다 뒤여야 합니다.");

    try {
      const result = await createBookings(user, {
        facilityId: data.facilityId, startAt, endAt, purpose: data.purpose, headcount: data.headcount ?? null,
        requestNote: data.requestNote ?? null, products: data.products, brandItems: data.brandItems, repeatWeeks: data.repeatWeeks,
        skipConflicts: data.skipConflicts, dryRun: data.dryRun,
      });
      if (data.dryRun) return ok({ results: result.results, autoApproved: result.autoApproved });
      return ok({
        bookings: result.created.map((b) => ({ id: b.id, code: b.code, status: b.status, startAt: b.startAt, endAt: b.endAt })),
        results: result.results, autoApproved: result.autoApproved,
      }, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "예약 신청에 실패했습니다.";
      if (msg === "UNAUTHORIZED" || msg === "FORBIDDEN") throw e;
      return fail(msg, 409);
    }
  } catch (e) { return handleError(e); }
}
