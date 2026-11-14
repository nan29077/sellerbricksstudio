import { prisma } from "./prisma";
import { getPolicy } from "./policy";

// 최고관리자 정책에서 '이메일 인증 필수'를 켜면, 인증하지 않은 계정은 예약 · 방송 · 브랜드 거래를 할 수 없다.
// (메일 발송 설정을 마친 뒤 켜는 것을 권장. 기본은 꺼짐)
export async function emailVerifyBlock(user: { id: string; role?: string }): Promise<string | null> {
  if (user.id.startsWith("demo-")) return null;
  if (user.role === "SUPER_ADMIN") return null; // 본사 계정은 인증 없이 브랜드 거래를 한다
  const { requireEmailVerify } = await getPolicy();
  if (!requireEmailVerify) return null;
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } });
  return row?.emailVerifiedAt ? null : "이메일 인증 후 이용할 수 있습니다. 설정 화면에서 인증 메일을 다시 받을 수 있습니다.";
}
