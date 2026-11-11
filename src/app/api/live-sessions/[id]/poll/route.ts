import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";

// 가벼운 폴링: numberVersion + 상품 목록 반환 (구매자/셀러 화면 실시간 반영)
// 시청자마다 4초마다 호출하므로, 같은 방송은 1.5초 동안 서버 메모리에 담아 DB 조회를 줄인다.
const CACHE_MS = 1500;
const cache = new Map<string, { at: number; data: unknown }>();

async function load(id: string) {
  return prisma.liveSession.findUnique({
    where: { id },
    select: {
      id: true, status: true, numberVersion: true,
      products: {
        where: { isActive: true },
        orderBy: { displayNumber: "asc" },
        select: { id: true, displayNumber: true, nameSnapshot: true, priceSnapshot: true, stockSnapshot: true, imageSnapshot: true, optionSnapshot: true, source: true, sortOrder: true, fulfillment: true, brandProductId: true, facilityProductId: true },
      },
    },
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (typeof params.id !== "string" || params.id.length > 64) return fail("세션을 찾을 수 없습니다.", 404);
  const hit = cache.get(params.id);
  if (hit && Date.now() - hit.at < CACHE_MS) return ok(hit.data);
  const s = await load(params.id);
  if (!s) return fail("세션을 찾을 수 없습니다.", 404);
  if (cache.size > 500) cache.clear();
  cache.set(params.id, { at: Date.now(), data: s });
  return ok(s);
}
