import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";

// 코드에 고정된 데모 계정은 개발 환경에서만 허용한다.
// 배포 환경에서 데모 로그인이 필요하면 DEMO_LOGIN=true 를 명시적으로 설정한다.
export function demoLoginEnabled(): boolean {
  if (process.env.DEMO_LOGIN === "false") return false;
  return process.env.NODE_ENV !== "production" || process.env.DEMO_LOGIN === "true";
}

// 로그인 무차별 대입 방지: 같은 이메일로 10분 안에 5번 실패하면 10분간 차단 (서버 인스턴스 메모리 기준)
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;
const loginFails = new Map<string, { count: number; first: number }>();

function isLoginLocked(key: string): boolean {
  const entry = loginFails.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) { loginFails.delete(key); return false; }
  return entry.count >= LOGIN_MAX_FAILS;
}
function recordLoginFail(key: string) {
  const entry = loginFails.get(key);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) loginFails.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();
        if (isLoginLocked(email)) throw new Error("로그인 시도가 너무 많습니다. 10분 후 다시 시도해 주세요.");

        const DEMO_USERS: Record<string, { id: string; name: string; role: Role; pw: string }> = {
          "admin@sellerbricks.kr":    { id: "demo-admin",    name: "최고관리자",            role: "SUPER_ADMIN" as Role, pw: "password1234" },
          "manager@sellerbricks.kr":  { id: "demo-manager",  name: "중간관리자 (영업담당)", role: "MANAGER",             pw: "password1234" },
          "facility@sellerbricks.kr": { id: "demo-facility", name: "창고(스튜디오) 관리자", role: "FACILITY_ADMIN", pw: "password1234" },
          "seller@sellerbricks.kr":   { id: "demo-seller",   name: "셀러",                 role: "SELLER",              pw: "password1234" },
        };
        const demo = demoLoginEnabled() ? DEMO_USERS[email] : undefined;
        const demoUser = demo && credentials.password === demo.pw
          ? { id: demo.id, email, role: demo.role, name: demo.name } : null;

        // DB 계정을 우선 사용한다. (데모 고정 계정은 DB 계정이 없거나 DB에 연결할 수 없을 때만 사용)
        // 데모 id로 로그인하면 DB에 저장되는 예약·문의 등이 본인 데이터로 연결되지 않기 때문.
        try {
          const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } }, include: { profile: true },
          });
          if (!user) { if (demoUser) return demoUser; recordLoginFail(email); return null; }
          if (!user.isActive) { recordLoginFail(email); return null; }
          const ok = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!ok) { recordLoginFail(email); return null; }
          loginFails.delete(email);
          prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
          return { id: user.id, email: user.email, role: user.role, name: user.profile?.name ?? user.email };
        } catch {
          return demoUser;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = (user as any).role; token.uid = (user as any).id; }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid as string;
        (session.user as any).role = token.role as Role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export type SessionUser = { id: string; email: string; name?: string | null; role: Role };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as any;
  // 최고관리자가 정지한 계정은 이미 로그인된 세션이라도 즉시 막는다.
  if (u.id && !String(u.id).startsWith("demo-")) {
    try {
      const row = await prisma.user.findUnique({ where: { id: u.id }, select: { isActive: true } });
      if (row && !row.isActive) return null;
    } catch {
      // DB에 연결할 수 없을 때는 세션 정보만으로 진행한다.
    }
  }
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new Error("FORBIDDEN");
  return u;
}
