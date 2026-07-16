import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";

// 프로필 관리: 이름/연락처/프로필 이미지 인덱스 저장
export async function PATCH(req: NextRequest) {
  try {
    const u = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { name, phone, profileImageIndex } = body ?? {};

    // 데모 계정(admin@/manager@/facility@/seller@)은 DB 레코드가 없으므로 저장하지 않음
    if (u.id.startsWith("demo-")) {
      return ok({ demo: true, message: "데모 계정은 변경 내용이 저장되지 않습니다." });
    }

    const dataUser: Record<string, unknown> = {};
    if (typeof profileImageIndex === "number" && profileImageIndex >= 1 && profileImageIndex <= 20) {
      dataUser.profileImageIndex = profileImageIndex;
    }

    await prisma.user.update({
      where: { id: u.id },
      data: {
        ...dataUser,
        profile: {
          upsert: {
            create: { name: (name ?? u.email) as string, phone: phone ?? null },
            update: {
              ...(name != null ? { name: name as string } : {}),
              ...(phone !== undefined ? { phone: phone ?? null } : {}),
            },
          },
        },
      },
    });

    return ok({ saved: true });
  } catch (e) {
    return handleError(e);
  }
}
