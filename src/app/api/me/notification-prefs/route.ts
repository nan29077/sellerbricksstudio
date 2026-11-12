import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";

// PATCH /api/me/notification-prefs — 설정 > 알림 (주문 · 정산 · 라이브 알림 켜기/끄기)
const schema = z.object({ order: z.boolean(), settlement: z.boolean(), live: z.boolean() });

export async function PATCH(req: NextRequest) {
  try {
    const u = await requireUser();
    if (u.id.startsWith("demo-")) return fail("데모 계정은 설정이 저장되지 않습니다.");
    const prefs = schema.parse(await req.json().catch(() => ({})));
    const name = (await prisma.profile.findUnique({ where: { userId: u.id }, select: { id: true } })) ? undefined : (u.name ?? u.email);
    await prisma.profile.upsert({
      where: { userId: u.id },
      create: { userId: u.id, name: name ?? u.email, notifyPrefs: prefs },
      update: { notifyPrefs: prefs },
    });
    return ok(prefs);
  } catch (e) { return handleError(e); }
}
