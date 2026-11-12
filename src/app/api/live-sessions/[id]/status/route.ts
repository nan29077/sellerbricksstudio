import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";

const ALLOWED = ["DRAFT", "READY", "LIVE", "ENDED", "CANCELLED"];
// 방송 상태는 정해진 순서로만 바뀐다. (종료된 방송을 다시 LIVE 로 되돌리지 못하게) 최고관리자는 예외.
const NEXT: Record<string, string[]> = {
  DRAFT: ["READY", "LIVE", "CANCELLED"],
  READY: ["DRAFT", "LIVE", "CANCELLED"],
  LIVE: ["ENDED", "CANCELLED"],
  ENDED: [],
  CANCELLED: [],
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const s = await prisma.liveSession.findUnique({ where: { id: params.id }, include: { facility: true } });
    if (!s) return fail("세션을 찾을 수 없습니다.", 404);
    if (!(s.sellerId === user.id || s.facility?.ownerId === user.id || user.role === "SUPER_ADMIN")) return fail("권한이 없습니다.", 403);
    const { status } = await req.json();
    if (!ALLOWED.includes(status)) return fail("허용되지 않은 상태입니다.");
    if (s.status === "CANCELLED" && user.role !== "SUPER_ADMIN") return fail("취소된 방송은 상태를 바꿀 수 없습니다.");
    if (status === s.status) return ok(s);
    // 라이브 기능이 꺼져 있으면 새로 방송을 시작하지 못한다. (진행 중인 방송의 종료 · 취소는 가능)
    if (status === "LIVE" && user.role !== "SUPER_ADMIN" && !(await getSettings()).liveEnabled) {
      return fail("지금은 라이브 기능이 꺼져 있어 방송을 시작할 수 없습니다. 최고관리자에게 문의해 주세요.", 403);
    }
    // 예정 종료 시각이 이미 지난 방송은 시작하지 못한다. (시작하자마자 자동 종료되는 것을 막는다)
    if (status === "LIVE" && user.role !== "SUPER_ADMIN" && s.scheduledEnd && s.scheduledEnd.getTime() <= Date.now()) {
      return fail("방송 예정 시간이 이미 지났습니다. 새 예약으로 방송을 다시 만들어 주세요.", 409);
    }
    if (user.role !== "SUPER_ADMIN" && !(NEXT[s.status] ?? []).includes(status)) {
      return fail(s.status === "ENDED" ? "종료된 방송은 다시 시작할 수 없습니다. 새 방송을 만들어 주세요." : "현재 방송 상태에서는 바꿀 수 없는 상태입니다.", 409);
    }

    const updated = await prisma.liveSession.update({
      where: { id: params.id },
      data: { status, ...(status === "ENDED" ? { endedAt: new Date() } : s.status === "ENDED" ? { endedAt: null } : {}) },
    });
    await audit({ actorId: user.id, action: `LIVE_${status}`, entity: "LiveSession", entityId: s.id });
    return ok(updated);
  } catch (e) { return handleError(e); }
}
