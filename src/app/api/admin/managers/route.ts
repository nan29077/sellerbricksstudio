import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { randomProfileIndex } from "@/lib/profile";

const schema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(40),
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력하세요."),
  password: z.string().min(8, "임시 비밀번호는 8자 이상이어야 합니다.").max(100),
  facility: z.string().trim().max(60).optional(),
});

// POST /api/admin/managers — 최고관리자가 중간관리자 계정을 직접 만든다.
// 담당 공간 이름을 넣으면 이름이 정확히 하나와 일치할 때 바로 연결한다.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
    const d = parsed.data;

    const exists = await prisma.user.findFirst({ where: { email: { equals: d.email, mode: "insensitive" } } });
    if (exists) return fail("이미 가입된 이메일입니다.", 409);

    let facility: { id: string; name: string } | null = null;
    let facilityNote: string | null = null;
    if (d.facility) {
      const matches = await prisma.facility.findMany({
        where: { name: { contains: d.facility, mode: "insensitive" } },
        select: { id: true, name: true }, take: 2,
      });
      if (matches.length === 1) facility = matches[0];
      else facilityNote = matches.length === 0
        ? `'${d.facility}'와 일치하는 공간이 없어 담당 연결은 하지 않았습니다.`
        : `'${d.facility}'와 일치하는 공간이 여러 개라 담당 연결은 하지 않았습니다.`;
    }

    const user = await prisma.user.create({
      data: {
        email: d.email, role: "MANAGER",
        passwordHash: await bcrypt.hash(d.password, 10),
        profileImageIndex: randomProfileIndex(),
        profile: { create: { name: d.name } },
        ...(facility ? { managedFacilities: { create: { facilityId: facility.id } } } : {}),
      },
      select: { id: true, email: true },
    });
    await audit({ actorId: admin.id, action: "MANAGER_CREATE", entity: "User", entityId: user.id, meta: { facilityId: facility?.id ?? null } });
    return ok({ ...user, facility: facility?.name ?? null, note: facilityNote }, 201);
  } catch (e) { return handleError(e); }
}
