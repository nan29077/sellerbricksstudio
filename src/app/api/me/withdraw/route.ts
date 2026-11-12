import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { withdrawAccount, withdrawBlockers } from "@/lib/account-withdraw";
import { consume, MINUTE } from "@/lib/rate-limit";

// GET  /api/me/withdraw — 지금 탈퇴할 수 있는지 (막는 이유 목록)
// POST /api/me/withdraw { password, confirm: "탈퇴" } — 회원 탈퇴
export async function GET() {
  try {
    const u = await requireUser();
    if (u.id.startsWith("demo-")) return ok({ blockers: ["데모 계정은 탈퇴할 수 없습니다."] });
    return ok({ blockers: await withdrawBlockers(u.id) });
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser();
    if (u.id.startsWith("demo-")) return fail("데모 계정은 탈퇴할 수 없습니다.");
    if (!(await consume(`withdraw:${u.id}`, 5, 10 * MINUTE))) return fail("시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
    const body = (await req.json().catch(() => ({}))) as { password?: unknown; confirm?: unknown };
    if (body.confirm !== "탈퇴") return fail("확인 칸에 '탈퇴'를 입력해 주세요.");
    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { passwordHash: true, withdrawnAt: true } });
    if (!user || user.withdrawnAt) return fail("계정을 찾을 수 없습니다.", 404);
    if (!(await bcrypt.compare(String(body.password ?? ""), user.passwordHash))) return fail("비밀번호가 올바르지 않습니다.");
    const blockers = await withdrawBlockers(u.id);
    if (blockers.length) return fail(`탈퇴하기 전에 정리할 것이 있습니다. ${blockers.join(" ")}`, 409);
    await withdrawAccount(u.id);
    await audit({ actorId: u.id, action: "USER_WITHDRAW", entity: "User", entityId: u.id });
    return ok({ withdrawn: true });
  } catch (e) { return handleError(e); }
}
