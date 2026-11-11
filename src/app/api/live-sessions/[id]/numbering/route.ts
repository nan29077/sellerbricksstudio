import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";

// body: { order: [lspId, ...] } -> sortOrder 갱신
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const s = await prisma.liveSession.findUnique({ where: { id: params.id }, include: { facility: true } });
    if (!s) throw new Error("세션을 찾을 수 없습니다.");
    if (!(s.sellerId === user.id || s.facility?.ownerId === user.id || user.role === "SUPER_ADMIN")) throw new Error("FORBIDDEN");
    const { order } = await req.json() as { order: unknown };
    if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) return fail("순서 정보가 올바르지 않습니다.");
    // 이 방송에 속한 상품만 순서를 바꿀 수 있다.
    const owned = await prisma.liveSessionProduct.count({ where: { id: { in: order as string[] }, liveSessionId: params.id } });
    if (owned !== new Set(order).size) return fail("이 방송의 상품이 아닌 항목이 포함되어 있습니다.", 403);
    await prisma.$transaction((order as string[]).map((id, i) =>
      prisma.liveSessionProduct.updateMany({ where: { id, liveSessionId: params.id }, data: { sortOrder: i } })
    ));
    await prisma.liveSession.update({ where: { id: params.id }, data: { numberVersion: { increment: 1 } } });
    return ok({ updated: (order as string[]).length });
  } catch (e) { return handleError(e); }
}
