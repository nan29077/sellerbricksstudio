import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { randomProfileIndex } from "@/lib/profile";
import { getSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = signupSchema.parse(body);
    data.email = data.email.trim().toLowerCase();
    if (data.email === "brand@sellerbricks.kr") return fail("다른 이메일을 사용해 주세요.", 409);

    // 최고관리자가 가입을 막아둔 역할은 서버에서도 거절한다.
    const { managerDisabled, facilityDisabled } = await getSettings();
    if ((data.role === "MANAGER" && managerDisabled) || (data.role === "FACILITY_ADMIN" && facilityDisabled)) {
      return fail("현재 이 역할로는 가입할 수 없습니다.", 403);
    }

    const exists = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: "insensitive" } } });
    if (exists) return fail("이미 가입된 이메일입니다.", 409);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email, passwordHash, role: data.role,
        profileImageIndex: randomProfileIndex(),
        profile: { create: { name: data.name, phone: data.phone, companyName: data.companyName } },
      },
    });
    await audit({ actorId: user.id, action: "SIGNUP", entity: "User", entityId: user.id, meta: { role: data.role } });
    return ok({ id: user.id, email: user.email, role: user.role }, 201);
  } catch (e) {
    return handleError(e);
  }
}
