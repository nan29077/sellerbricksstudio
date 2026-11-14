import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";

// 찜 토글: { facilityId } → { favorited }
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { facilityId } = await req.json().catch(() => ({}));
    if (typeof facilityId !== "string" || !facilityId) return fail("공간을 선택하세요.");
    const exists = await prisma.facilityFavorite.findUnique({ where: { userId_facilityId: { userId: user.id, facilityId } } });
    if (exists) {
      await prisma.facilityFavorite.delete({ where: { id: exists.id } });
      return ok({ favorited: false });
    }
    const f = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } });
    if (!f) return fail("공간을 찾을 수 없습니다.", 404);
    await prisma.facilityFavorite.create({ data: { userId: user.id, facilityId } });
    return ok({ favorited: true });
  } catch (e) { return handleError(e); }
}
