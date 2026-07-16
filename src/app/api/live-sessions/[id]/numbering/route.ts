import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

// body: { order: [lspId, ...] } -> sortOrder 갱신
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const s = await prisma.liveSession.findUnique({ where: { id: params.id }, include: { facility: true } });
    if (!s) throw new Error("세션을 찾을 수 없습니다.");
    if (!(s.sellerId === user.id || s.facility.ownerId === user.id || user.role === "SUPER_ADMIN")) throw new Error("FORBIDDEN");
    const { order } = await req.json() as { order: string[] };
    await prisma.$transaction(order.map((id, i) =>
      prisma.liveSessionProduct.update({ where: { id }, data: { sortOrder: i } })
    ));
    await prisma.liveSession.update({ where: { id: params.id }, data: { numberVersion: { increment: 1 } } });
    return ok({ updated: order.length });
  } catch (e) { return handleError(e); }
}
