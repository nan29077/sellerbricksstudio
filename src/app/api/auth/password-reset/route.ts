import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";
import { sendResetEmail } from "@/lib/auth-tokens";

// POST /api/auth/password-reset { email } — 비밀번호 재설정 메일 발송
// 가입 여부를 알 수 없도록 항상 같은 답을 준다. 이메일·IP별로 횟수를 제한한다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("이메일 주소를 확인해 주세요.");
  if (!(await consume(`reset:ip:${clientIp(req)}`, 10, 10 * MINUTE))) return fail("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  const message = "가입된 이메일이라면 비밀번호 재설정 링크를 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.";
  if (!(await consume(`reset:email:${email}`, 3, 30 * MINUTE))) return ok({ message });
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, isActive: true }, select: { id: true, email: true } });
  if (!user) return ok({ message });
  const sent = await sendResetEmail(user.id, user.email);
  return ok({ message, ...(sent.devLink && { devLink: sent.devLink }) });
}
