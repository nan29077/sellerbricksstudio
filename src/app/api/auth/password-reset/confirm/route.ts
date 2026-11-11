import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { consumeToken, peekToken } from "@/lib/auth-tokens";
import { clearLimit } from "@/lib/rate-limit";

// GET ?token= — 링크가 아직 유효한지 확인 (화면 표시용)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  return ok({ valid: await peekToken(token, "PASSWORD_RESET") });
}

// POST { token, password } — 새 비밀번호 저장. 다른 기기의 로그인은 모두 끊는다.
export async function POST(req: NextRequest) {
  if (!(await consume(`reset-confirm:ip:${clientIp(req)}`, 20, 10 * MINUTE))) return fail("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 100) return fail("새 비밀번호는 8자 이상 100자 이하로 입력해 주세요.");
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) return fail("링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.", 400);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10), sessionVersion: { increment: 1 } },
    select: { id: true, email: true },
  });
  await prisma.authToken.deleteMany({ where: { userId, type: "PASSWORD_RESET" } });
  await clearLimit(`login:fail:${user.email.toLowerCase()}`);
  await audit({ actorId: userId, action: "PASSWORD_RESET", entity: "User", entityId: userId });
  return ok({ changed: true });
}
