import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { getCatenoidAdapter } from "@/lib/adapters/catenoid";
import { audit } from "@/lib/audit";

const ALLOWED = ["DRAFT", "READY", "LIVE", "ENDED", "CANCELLED"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const s = await prisma.liveSession.findUnique({ where: { id: params.id }, include: { facility: true } });
    if (!s) return fail("세션을 찾을 수 없습니다.", 404);
    if (!(s.sellerId === user.id || s.facility.ownerId === user.id || user.role === "SUPER_ADMIN")) return fail("권한이 없습니다.", 403);
    const { status } = await req.json();
    if (!ALLOWED.includes(status)) return fail("허용되지 않은 상태입니다.");

    if (status === "ENDED" && s.catenoidStreamId) {
      await getCatenoidAdapter().endLiveStream(s.catenoidStreamId);
      await prisma.catenoidStreamLog.create({ data: { liveSessionId: s.id, action: "END" } });
    }
    const updated = await prisma.liveSession.update({ where: { id: params.id }, data: { status } });
    await audit({ actorId: user.id, action: `LIVE_${status}`, entity: "LiveSession", entityId: s.id });
    return ok(updated);
  } catch (e) { return handleError(e); }
}
