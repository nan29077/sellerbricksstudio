import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { canOperateFacility, FACILITY_OPERATOR_ROLES } from "@/lib/facility-owner";

const patchSchema = z.object({
  salePrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  consumerPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  supplyPrice: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.union([z.coerce.number().int().min(0, "공급가는 0원 이상입니다.").max(100_000_000), z.null()])).optional(), // 셀러 공급가 (비우면 셀러 수수료 방식)
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  commissionType: z.enum(["PERCENT", "FIXED"]).optional(),
  commissionValue: z.coerce.number().min(0).optional(),
  isSellable: z.boolean().optional(),
  shippingInfo: z.string().max(500).optional(),
  // 상품 기본 정보 (마스터 상품)
  name: z.string().trim().min(1, "상품명을 입력하세요.").max(120).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  sku: z.string().trim().max(60).optional(),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().trim().max(1000).optional(),
}).strip();

// 창고 운영자(최고관리자 · 담당 매니저)만 상품을 고친다
async function editableProduct(user: SessionUser, fpId: string) {
  const fp = await prisma.facilityProduct.findUnique({ where: { id: fpId } });
  if (!fp || !(await canOperateFacility(user, fp.facilityId))) throw new Error("FORBIDDEN");
  return fp;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(FACILITY_OPERATOR_ROLES);
    const fp = await editableProduct(user, params.id);
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
    const { name, category, sku, description, thumbnailUrl, ...fpData } = parsed.data;
    if (fpData.commissionType === "PERCENT" && (fpData.commissionValue ?? 0) > 100) return fail("정률 수수료는 100%를 넘을 수 없습니다.");
    const nextSale = fpData.salePrice ?? fp.salePrice;
    const nextSupply = fpData.supplyPrice !== undefined ? fpData.supplyPrice : fp.supplyPrice;
    if (nextSupply != null && nextSupply > nextSale) return fail("셀러 공급가는 판매가보다 클 수 없습니다.");
    // 브랜드에서 가져온 상품: 공급가 아래로 팔 수 없고, 직배송 판매 한도는 브랜드 재고를 넘을 수 없다.
    if (fp.brandProductId) {
      const bp = await prisma.brandProduct.findUnique({ where: { id: fp.brandProductId }, select: { supplyPrice: true, minSalePrice: true, salePrice: true, priceRule: true, stock: true, isActive: true, allowDropship: true, shop: { select: { status: true } } } });
      if (bp && fpData.salePrice !== undefined && fpData.salePrice < bp.supplyPrice) return fail(`판매가는 브랜드 공급가(${bp.supplyPrice.toLocaleString()}원)보다 낮을 수 없습니다.`);
      if (bp?.minSalePrice != null && fpData.salePrice !== undefined && fpData.salePrice < bp.minSalePrice) return fail(`판매가는 브랜드 최저 판매가(${bp.minSalePrice.toLocaleString()}원)보다 낮을 수 없습니다.`);
      if (bp && bp.priceRule === "FIXED" && bp.salePrice > 0 && fpData.salePrice !== undefined && fpData.salePrice !== bp.salePrice) return fail(`브랜드가 판매가를 ${bp.salePrice.toLocaleString()}원으로 고정한 상품입니다.`);
      if (bp && nextSupply != null && nextSupply < bp.supplyPrice) return fail(`셀러 공급가는 브랜드 공급가(${bp.supplyPrice.toLocaleString()}원)보다 낮을 수 없습니다.`);
      if (bp && fpData.isSellable && bp.shop.status !== "APPROVED") return fail("브랜드샵이 공개 중지되어 판매할 수 없는 상품입니다.");
      if (bp && fp.fulfillment === "DROPSHIP" && fpData.stock !== undefined && fpData.stock > bp.stock) return fail(`직배송 판매 한도는 브랜드 재고(${bp.stock.toLocaleString()}개)를 넘을 수 없습니다.`);
      // 창고 입고(위탁) 상품 재고는 브랜드가 보낸 수량만큼 '입고 확인'으로만 늘어난다. (직접 올리면 받지 않은 수량까지 팔려 브랜드 발주가 생긴다) 줄이는 것은 가능
      if (fp.fulfillment === "WAREHOUSE" && fpData.stock !== undefined && fpData.stock > fp.stock && user.role !== "SUPER_ADMIN") {
        return fail("창고 입고(위탁) 상품의 재고는 직접 늘릴 수 없습니다. 브랜드에 입고를 요청하고, 상품을 받은 뒤 '입고 확인'을 하면 재고가 늘어납니다.");
      }
      if (bp && fp.fulfillment === "DROPSHIP" && fpData.isSellable && (!bp.isActive || !bp.allowDropship)) return fail("브랜드가 직배송 판매를 중단한 상품입니다.");
    }
    const productData = Object.fromEntries(Object.entries({ name, category, sku, description, thumbnailUrl }).filter(([, v]) => v !== undefined).map(([k, v]) => [k, k === "name" || k === "category" ? v : (v || null)]));
    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(productData).length) await tx.product.update({ where: { id: fp.productId }, data: productData });
      return tx.facilityProduct.update({ where: { id: params.id }, data: fpData });
    });
    await audit({ actorId: user.id, action: "PRODUCT_UPDATE", entity: "FacilityProduct", entityId: params.id });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(FACILITY_OPERATOR_ROLES);
    await editableProduct(user, params.id);
    // 방송에 쓰인 상품은 기록 보존을 위해 삭제 대신 판매 중단 처리한다.
    const [inLive, inBookings] = await Promise.all([
      prisma.liveSessionProduct.count({ where: { facilityProductId: params.id } }),
      prisma.bookingProduct.count({ where: { facilityProductId: params.id } }),
    ]);
    const used = inLive + inBookings;
    if (used > 0) {
      await prisma.facilityProduct.update({ where: { id: params.id }, data: { isSellable: false } });
    } else {
      await prisma.facilityProduct.delete({ where: { id: params.id } });
    }
    await audit({ actorId: user.id, action: "PRODUCT_DELETE", entity: "FacilityProduct", entityId: params.id, meta: { softDeleted: used > 0 } });
    return ok({ deleted: true, softDeleted: used > 0 });
  } catch (e) { return handleError(e); }
}
