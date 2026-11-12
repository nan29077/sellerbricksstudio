import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { addLiveProductSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { brandSnapshotForFacilityProduct } from "@/lib/brand-links";
import { optionSnapshotOf } from "@/lib/brands";

// 세션 접근 권한: 셀러 본인 또는 창고(스튜디오) 소유 창고(스튜디오) 관리자
async function assertAccess(userId: string, role: string, sessionId: string) {
  const s = await prisma.liveSession.findUnique({ where: { id: sessionId }, include: { facility: true } });
  if (!s) throw new Error("세션을 찾을 수 없습니다.");
  const allowed = s.sellerId === userId || s.facility?.ownerId === userId || role === "SUPER_ADMIN";
  if (!allowed) throw new Error("FORBIDDEN");
  return s;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const session = await assertAccess(user.id, user.role, params.id);
    if (session.status === "ENDED" || session.status === "CANCELLED") return fail("종료되거나 취소된 방송에는 상품을 추가할 수 없습니다.");
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

    type BrandFields = { brandProductId?: string; fulfillment?: "DROPSHIP" | "WAREHOUSE"; supplyPriceSnapshot?: number; optionSnapshot?: string | null; facilitySupplySnapshot?: number | null; commissionTypeSnapshot?: "PERCENT" | "FIXED"; commissionValueSnapshot?: number };
    let snapshot: { name: string; price: number; stock: number; image?: string | null; source: "CATALOG" | "AD_HOC"; facilityProductId?: string; brand?: BrandFields };
    if (data.sellerBrandProductId) {
      // 셀러가 가져온 브랜드 상품은 셀러 본인 공간 방송에서만 판다 (창고(스튜디오) 방송은 창고 상품)
      if (session.facilityId) return fail("셀러가 가져온 브랜드 상품은 '내 공간에서 방송'으로 만든 방송에서만 판매할 수 있습니다.", 400);
      // 셀러가 브랜드샵에서 가져온 직배송 상품
      const listing = await prisma.sellerBrandProduct.findUnique({
        where: { id: data.sellerBrandProductId },
        include: { brandProduct: { include: { shop: { select: { status: true, owner: { select: { isActive: true } } } } } } },
      });
      if (!listing || listing.sellerId !== session.sellerId) return fail("이 방송 셀러가 가져온 브랜드 상품만 추가할 수 있습니다.", 403);
      const bp = listing.brandProduct;
      if (!listing.isActive || !bp.isActive || !bp.allowDropship || bp.shop.status !== "APPROVED" || !bp.shop.owner.isActive) {
        return fail("지금은 판매할 수 없는 브랜드 상품입니다.");
      }
      if (bp.stock < 1) return fail("브랜드 재고가 없습니다.");
      // 같은 셀러 직배송 상품만 중복으로 본다 (창고(스튜디오) 위탁 · 직배송 상품은 별도 판매 상품)
      const exists = await prisma.liveSessionProduct.findFirst({ where: { liveSessionId: params.id, brandProductId: bp.id, facilityProductId: null, isActive: true } });
      if (exists) return fail("이미 추가된 상품입니다.", 409);
      snapshot = {
        name: bp.name, price: listing.salePrice, stock: bp.stock, image: bp.imageUrl || null, source: "CATALOG",
        brand: { brandProductId: bp.id, fulfillment: "DROPSHIP", supplyPriceSnapshot: bp.supplyPrice, optionSnapshot: optionSnapshotOf(bp.options) },
      };
    } else if (data.facilityProductId) {
      const fp = await prisma.facilityProduct.findUnique({ where: { id: data.facilityProductId }, include: { product: true } });
      if (!fp) return fail("상품을 찾을 수 없습니다.", 404);
      if (!session.facilityId || fp.facilityId !== session.facilityId) return fail("이 방송 장소의 상품만 추가할 수 있습니다.", 403);
      if (!fp.isSellable) return fail("판매 중단된 상품입니다.");
      const exists = await prisma.liveSessionProduct.findFirst({ where: { liveSessionId: params.id, facilityProductId: fp.id } });
      if (exists) return fail("이미 추가된 상품입니다.", 409);
      snapshot = { name: fp.product.name, price: fp.salePrice, stock: fp.stock, image: fp.product.thumbnailUrl, source: "CATALOG", facilityProductId: fp.id, brand: await brandSnapshotForFacilityProduct(prisma, fp.id) };
    } else {
      // 방송 중 임시상품 추가: 임시 상품은 창고(스튜디오)가 출고하고 판매금도 창고 몫이므로 방송 장소 창고(스튜디오) 관리자만 추가한다.
      // (셀러는 창고 상품 · 가져온 브랜드 상품만 판다. 셀러 공간 방송에는 임시 상품을 올릴 수 없다)
      if (user.role !== "SUPER_ADMIN" && !(session.facility && session.facility.ownerId === user.id)) {
        return fail(session.facilityId ? "임시 상품은 방송 장소 창고(스튜디오)만 추가할 수 있습니다. 창고(스튜디오)에 요청해 주세요." : "내 공간 방송에서는 브랜드샵에서 가져온 상품만 판매할 수 있습니다.", 403);
      }
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
          ...(snapshot.brand ?? {}),
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
