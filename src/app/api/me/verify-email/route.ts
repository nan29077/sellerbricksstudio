import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { consume, MINUTE } from "@/lib/rate-limit";
import { sendVerifyEmail } from "@/lib/auth-tokens";

// GET — 내 이메일 인증 상태 / POST — 인증 메일 다시 보내기
export async function GET() {
  try {
    const u = await requireUser();
    if (u.id.startsWith("demo-")) return ok({ verified: false, demo: true });
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { emailVerifiedAt: true, email: true } });
    return ok({ verified: !!row?.emailVerifiedAt, email: row?.email });
  } catch (e) { return handleError(e); }
}

export async function POST() {
  try {
    const u = await requireUser();
    if (u.id.startsWith("demo-")) return fail("데모 계정은 인증할 수 없습니다.");
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { emailVerifiedAt: true, email: true } });
    if (!row) return fail("계정을 찾을 수 없습니다.", 404);
    if (row.emailVerifiedAt) return ok({ verified: true });
    if (!(await consume(`verify:send:${u.id}`, 3, 30 * MINUTE))) return fail("인증 메일은 30분에 3번까지 보낼 수 있습니다.", 429);
    const sent = await sendVerifyEmail(u.id, row.email);
    if (!sent.sent) return fail("메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
    return ok({ sent: true, ...(sent.devLink && { devLink: sent.devLink }) });
  } catch (e) { return handleError(e); }
}
