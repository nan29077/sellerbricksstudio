import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { randomProfileIndex } from "@/lib/profile";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = signupSchema.parse(body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return fail("이미 가입된 이메일입니다.", 409);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email, passwordHash, role: data.role,
        profileImageIndex: randomProfileIndex(), // 가입 시 1~20 랜덤 프로필 이미지 배정
        profile: { create: { name: data.name, phone: data.phone, companyName: data.companyName } },
      },
    });
    await audit({ actorId: user.id, action: "SIGNUP", entity: "User", entityId: user.id, meta: { role: data.role } });
    return ok({ id: user.id, email: user.email, role: user.role }, 201);
  } catch (e) {
    return handleError(e);
  }
}
