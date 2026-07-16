import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";

// 가벼운 폴링: numberVersion + 상품 목록 반환 (구매자/셀러 화면 실시간 반영)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = await prisma.liveSession.findUnique({
    where: { id: params.id },
    select: {
      id: true, status: true, numberVersion: true,
      products: {
        where: { isActive: true },
        orderBy: { displayNumber: "asc" },
        select: { id: true, displayNumber: true, nameSnapshot: true, priceSnapshot: true, stockSnapshot: true, imageSnapshot: true, source: true, sortOrder: true },
      },
    },
  });
  if (!s) return fail("세션을 찾을 수 없습니다.", 404);
  return ok(s);
}
