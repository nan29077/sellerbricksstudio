import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const DEMO_USERS: Record<string, { id: string; name: string; role: Role; pw: string }> = {
          "admin@sellerbricks.kr":    { id: "demo-admin",    name: "최고관리자",            role: "SUPER_ADMIN" as Role, pw: "password1234" },
          "manager@sellerbricks.kr":  { id: "demo-manager",  name: "중간관리자 (영업담당)", role: "MANAGER",             pw: "password1234" },
          "facility@sellerbricks.kr": { id: "demo-facility", name: "창고(스튜디오) 관리자", role: "FACILITY_ADMIN", pw: "password1234" },
          "seller@sellerbricks.kr":   { id: "demo-seller",   name: "셀러",                 role: "SELLER",              pw: "password1234" },
        };
        const demo = DEMO_USERS[credentials.email];
        if (demo && credentials.password === demo.pw) {
          return { id: demo.id, email: credentials.email, role: demo.role, name: demo.name };
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }, include: { profile: true },
          });
          if (!user || !user.isActive) return null;
          const ok = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!ok) return null;
          return { id: user.id, email: user.email, role: user.role, name: user.profile?.name ?? user.email };
        } catch {
          return null;
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
