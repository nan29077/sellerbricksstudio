import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";

// 비밀번호 변경: 현재 비밀번호 확인 → 새 비밀번호 저장
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser();
    const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) ?? {};

    if (!newPassword || String(newPassword).length < 8) {
      return fail("새 비밀번호는 8자 이상이어야 합니다.");
    }
    if (u.id.startsWith("demo-")) {
      return fail("데모 계정은 비밀번호를 변경할 수 없습니다.", 400);
    }

    const user = await prisma.user.findUnique({ where: { id: u.id } });
    if (!user) return fail("사용자를 찾을 수 없습니다.", 404);

    const valid = await bcrypt.compare(String(currentPassword ?? ""), user.passwordHash);
    if (!valid) return fail("현재 비밀번호가 올바르지 않습니다.", 400);

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash } });

    return ok({ changed: true });
  } catch (e) {
    return handleError(e);
  }
}
