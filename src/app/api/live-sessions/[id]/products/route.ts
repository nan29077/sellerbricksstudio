import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { addLiveProductSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

// 세션 접근 권한: 셀러 본인 또는 시설 소유 시설 운영자
async function assertAccess(userId: string, role: string, sessionId: string) {
  const s = await prisma.liveSession.findUnique({ where: { id: sessionId }, include: { facility: true } });
  if (!s) throw new Error("세션을 찾을 수 없습니다.");
  const allowed = s.sellerId === userId || s.facility.ownerId === userId || role === "SUPER_ADMIN";
  if (!allowed) throw new Error("FORBIDDEN");
  return s;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await assertAccess(user.id, user.role, params.id);
    const body = await req.json();
    const data = addLiveProductSchema.parse(body);

    // 다음 상품번호 자동 부여
    let displayNumber = data.displayNumber;
    if (!displayNumber) {
      const max = await prisma.liveSessionProduct.aggregate({
        where: { liveSessionId: params.id }, _max: { displayNumber: true },
      });
      displayNumber = (max._max.displayNumber ?? 0) + 1;
    } else {
      const dup = await prisma.liveSessionProduct.findUnique({
        where: { liveSessionId_displayNumber: { liveSessionId: params.id, displayNumber } },
      });
      if (dup) return fail("이미 사용 중인 상품번호입니다.", 409);
    }

    let snapshot: { name: string; price: number; stock: number; image?: string | null; source: "CATALOG" | "AD_HOC"; facilityProductId?: string };
    if (data.facilityProductId) {
      const fp = await prisma.facilityProduct.findUnique({ where: { id: data.facilityProductId }, include: { product: true } });
      if (!fp) return fail("상품을 찾을 수 없습니다.", 404);
      const exists = await prisma.liveSessionProduct.findFirst({ where: { liveSessionId: params.id, facilityProductId: fp.id } });
      if (exists) return fail("이미 추가된 상품입니다.", 409);
      snapshot = { name: fp.product.name, price: fp.salePrice, stock: fp.stock, image: fp.product.thumbnailUrl, source: "CATALOG", facilityProductId: fp.id };
    } else {
      // 방송 중 임시상품 추가
      if (!data.name || data.price == null) return fail("임시상품은 상품명과 가격이 필요합니다.");
      snapshot = { name: data.name, price: data.price, stock: data.stock ?? 0, image: data.image, source: "AD_HOC" };
    }

    const count = await prisma.liveSessionProduct.count({ where: { liveSessionId: params.id } });
    const created = await prisma.$transaction(async (tx) => {
      const lsp = await tx.liveSessionProduct.create({
        data: {
          liveSessionId: params.id, displayNumber, sortOrder: count,
          facilityProductId: snapshot.facilityProductId,
          nameSnapshot: snapshot.name, priceSnapshot: snapshot.price, stockSnapshot: snapshot.stock,
          imageSnapshot: snapshot.image, source: snapshot.source,
        },
      });
      await tx.liveProductNumberHistory.create({
        data: { liveSessionId: params.id, liveSessionProductId: lsp.id, newNumber: displayNumber!, changedBy: user.id },
      });
      await tx.liveSession.update({ where: { id: params.id }, data: { numberVersion: { increment: 1 } } });
      return lsp;
    });
    await audit({ actorId: user.id, action: "LIVE_PRODUCT_ADD", entity: "LiveSessionProduct", entityId: created.id, meta: { source: snapshot.source } });
    return ok(created, 201);
  } catch (e) { return handleError(e); }
}
