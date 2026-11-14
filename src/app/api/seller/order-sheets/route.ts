import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { submitSheets } from "@/lib/order-sheets";
import { emailVerifyBlock } from "@/lib/account-guards";
import { consume, MINUTE } from "@/lib/rate-limit";

const line = z.object({ code: z.string().trim().min(3).max(80), optionLabel: z.string().trim().max(200).nullish(), quantity: z.coerce.number().int().min(1).max(9999) });
const sheet = z.object({
  platform: z.string().trim().min(1).max(40), platformEtc: z.string().trim().max(60).nullish(), externalOrderNo: z.string().trim().max(60).nullish(),
  recipient: z.string().trim().max(40), phone: z.string().trim().max(30), address: z.string().trim().max(300), memo: z.string().trim().max(300).nullish(),
  lines: z.array(line).min(1).max(50), ref: z.string().max(40).optional(),
});
const schema = z.object({ sheets: z.array(sheet).min(1).max(300), method: z.enum(["CARD", "EASY_PAY", "BANK_TRANSFER"]).default("CARD") });

// POST — 셀러 주문서 제출: 주문서마다 공급가(+ 스토리지마켓 출고 배송비)를 결제하고 브랜드 · 창고로 발주한다.
//  주문서별 결과(성공 · 실패 사유)를 돌려준다. 한 장이 실패해도 나머지는 처리된다.
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const blocked = await emailVerifyBlock(user);
    if (blocked) return fail(blocked, 403);
    if (!(await consume(`sheet:${user.id}`, 30, 10 * MINUTE))) return fail("주문서 제출이 너무 잦습니다. 잠시 후 다시 시도해 주세요.", 429);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "주문서 형식을 확인하세요.");
    const results = await submitSheets(user, parsed.data.sheets, parsed.data.method);
    const okCount = results.filter((r) => r.ok).length;
    return ok({ results, success: okCount, failed: results.length - okCount }, okCount ? 201 : 200);
  } catch (e) { return handleError(e); }
}
