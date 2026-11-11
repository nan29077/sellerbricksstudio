import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { randomProfileIndex } from "@/lib/profile";
import { getSettings } from "@/lib/settings";
import { notifyAdmins } from "@/lib/notify";
import { sendVerifyEmail } from "@/lib/auth-tokens";
import { clientIp, consume, MINUTE } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    if (!(await consume(`signup:ip:${clientIp(req)}`, 10, 10 * MINUTE))) return fail("가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
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
        email: data.email, passwordHash, role: data.role, termsAgreedAt: new Date(), privacyAgreedAt: new Date(),
        profileImageIndex: randomProfileIndex(),
        profile: {
          create: {
            name: data.name, phone: data.phone, companyName: data.companyName,
            businessNumber: data.businessNumber || null, categories: Array.from(new Set(data.categories ?? [])),
          },
        },
        // 브랜드사는 가입과 동시에 브랜드샵(승인 대기)을 만든다.
        ...(data.role === "BRAND_ADMIN" && {
          brandShop: {
            create: {
              name: data.companyName!, categories: Array.from(new Set(data.categories ?? [])),
              businessNumber: data.businessNumber ?? "", ceoName: data.name, csPhone: data.phone ?? "",
            },
          },
        }),
      },
      include: { brandShop: { select: { id: true, name: true } } },
    });
    if (user.brandShop) {
      await notifyAdmins({ type: "SYSTEM", title: "신규 브랜드사 가입 · 공개 승인 요청", body: `${user.brandShop.name} · ${(data.categories ?? []).join(", ")}`, link: `/admin/brands/${user.brandShop.id}` });
    }
    await audit({ actorId: user.id, action: "SIGNUP", entity: "User", entityId: user.id, meta: { role: data.role } });
    await sendVerifyEmail(user.id, user.email).catch(() => null); // 인증 메일 (실패해도 가입은 유지, 설정에서 다시 보낼 수 있음)
    return ok({ id: user.id, email: user.email, role: user.role }, 201);
  } catch (e) {
    return handleError(e);
  }
}
