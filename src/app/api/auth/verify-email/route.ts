import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { consumeToken } from "@/lib/auth-tokens";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";

// POST /api/auth/verify-email { token } — 메일 링크로 이메일 인증 완료
export async function POST(req: NextRequest) {
  if (!(await consume(`verify:ip:${clientIp(req)}`, 30, 10 * MINUTE))) return fail("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  const body = await req.json().catch(() => ({}));
  const userId = await consumeToken(typeof body.token === "string" ? body.token : "", "EMAIL_VERIFY");
  if (!userId) return fail("인증 링크가 만료되었거나 이미 사용되었습니다. 설정 > 계정 정보에서 인증 메일을 다시 받아 주세요.");
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return ok({ verified: true });
}
