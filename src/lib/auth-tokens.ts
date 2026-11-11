import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { appUrl, sendMail } from "./mailer";

// 비밀번호 재설정 · 이메일 인증 토큰. 원문은 메일 링크로만 보내고 DB에는 SHA-256 해시만 저장한다.
export type TokenType = "PASSWORD_RESET" | "EMAIL_VERIFY";
const TTL: Record<TokenType, number> = { PASSWORD_RESET: 30 * 60 * 1000, EMAIL_VERIFY: 3 * 24 * 3600 * 1000 };

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueToken(userId: string, type: TokenType) {
  const token = randomBytes(32).toString("base64url");
  await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }); // 이전 링크는 무효
  await prisma.authToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL[type]) } });
  return token;
}

/** 유효한 토큰이면 사용 처리하고 userId 를 돌려준다 (한 번만 쓸 수 있음) */
export async function consumeToken(token: string, type: TokenType): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const used = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return used.count ? row.userId : null;
}

export async function peekToken(token: string, type: TokenType) {
  if (!token || token.length > 200) return false;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { type: true, usedAt: true, expiresAt: true } });
  return !!row && row.type === type && !row.usedAt && row.expiresAt > new Date();
}

export async function sendVerifyEmail(userId: string, email: string) {
  const token = await issueToken(userId, "EMAIL_VERIFY");
  const link = appUrl(`/verify-email?token=${token}`);
  const result = await sendMail(email, "[스토리지마켓] 이메일 주소를 인증해 주세요",
    `안녕하세요. 스토리지마켓 가입을 환영합니다.\n\n아래 링크를 눌러 이메일 주소를 인증해 주세요. (3일 동안 유효)\n${link}\n\n본인이 가입하지 않았다면 이 메일을 무시해 주세요.`);
  return { ...result, devLink: result.provider === "console" ? link : undefined };
}

export async function sendResetEmail(userId: string, email: string) {
  const token = await issueToken(userId, "PASSWORD_RESET");
  const link = appUrl(`/reset-password?token=${token}`);
  const result = await sendMail(email, "[스토리지마켓] 비밀번호 재설정 안내",
    `비밀번호 재설정을 요청하셨습니다.\n\n아래 링크에서 새 비밀번호를 정해 주세요. (30분 동안 한 번만 사용할 수 있습니다)\n${link}\n\n요청하지 않았다면 이 메일을 무시해 주세요. 비밀번호는 바뀌지 않습니다.`);
  return { ...result, devLink: result.provider === "console" ? link : undefined };
}
