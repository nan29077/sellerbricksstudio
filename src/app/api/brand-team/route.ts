import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { brandContext } from "@/lib/brand-access";
import { randomProfileIndex } from "@/lib/profile";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"), email: z.string().trim().toLowerCase().email("이메일을 확인해 주세요."), name: z.string().trim().min(1, "이름을 입력하세요.").max(40),
    password: z.string().min(8, "임시 비밀번호는 8자 이상이어야 합니다.").max(100),
  }),
  z.object({ action: z.literal("remove"), userId: z.string().min(1).max(64) }),
]);

// POST /api/brand-team — 브랜드 대표 계정이 팀원(직원) 계정을 만들거나 내보낸다. 팀원은 정산 계좌·팀 관리를 할 수 없다.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const ctx = await brandContext(user);
    if (!ctx) return fail("브랜드사 계정이 필요합니다.", 403);
    if (!ctx.isOwner) return fail("팀원 관리는 대표 계정만 할 수 있습니다.", 403);
    const data = schema.parse(await req.json().catch(() => ({})));
    if (data.action === "add") {
      const count = await prisma.brandMember.count({ where: { shopId: ctx.shop.id } });
      if (count >= 20) return fail("팀원은 20명까지 추가할 수 있습니다.");
      const exists = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: "insensitive" } }, select: { id: true } });
      if (exists) return fail("이미 가입된 이메일입니다. 다른 이메일을 사용해 주세요.", 409);
      const member = await prisma.user.create({
        data: {
          email: data.email, role: "BRAND_ADMIN", passwordHash: await bcrypt.hash(data.password, 10),
          profileImageIndex: randomProfileIndex(),
          profile: { create: { name: data.name, companyName: ctx.shop.name } },
          brandMembership: { create: { shopId: ctx.shop.id, createdBy: user.id } },
        },
        select: { id: true },
      });
      await audit({ actorId: user.id, action: "BRAND_MEMBER_ADD", entity: "User", entityId: member.id, meta: { shopId: ctx.shop.id } });
      return ok({ id: member.id }, 201);
    }
    const m = await prisma.brandMember.findFirst({ where: { shopId: ctx.shop.id, userId: data.userId } });
    if (!m) return fail("팀원을 찾지 못했습니다.", 404);
    // 팀원 계정은 이 브랜드 전용이므로 비활성화하고 로그인 세션도 끊는다
    await prisma.$transaction([
      prisma.brandMember.delete({ where: { id: m.id } }),
      prisma.user.update({ where: { id: data.userId }, data: { isActive: false, sessionVersion: { increment: 1 } } }),
    ]);
    await audit({ actorId: user.id, action: "BRAND_MEMBER_REMOVE", entity: "User", entityId: data.userId, meta: { shopId: ctx.shop.id } });
    return ok({ id: data.userId });
  } catch (e) { return handleError(e); }
}
