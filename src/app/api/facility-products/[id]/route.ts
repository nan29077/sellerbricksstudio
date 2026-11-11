import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  salePrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  consumerPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
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

async function editableProduct(user: SessionUser, fpId: string) {
  const fp = await prisma.facilityProduct.findFirst({
    where: { id: fpId, ...(user.role !== "SUPER_ADMIN" && { facility: { ownerId: user.id } }) },
  });
  if (!fp) throw new Error("FORBIDDEN");
  return fp;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    const fp = await editableProduct(user, params.id);
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
    const { name, category, sku, description, thumbnailUrl, ...fpData } = parsed.data;
    if (fpData.commissionType === "PERCENT" && (fpData.commissionValue ?? 0) > 100) return fail("정률 수수료는 100%를 넘을 수 없습니다.");
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
    const user = await requireRole(["FACILITY_ADMIN"]);
    await editableProduct(user, params.id);
    // 방송에 쓰인 상품은 기록 보존을 위해 삭제 대신 판매 중단 처리한다.
    const used = await prisma.liveSessionProduct.count({ where: { facilityProductId: params.id } });
    if (used > 0) {
      await prisma.facilityProduct.update({ where: { id: params.id }, data: { isSellable: false } });
    } else {
      await prisma.facilityProduct.delete({ where: { id: params.id } });
    }
    await audit({ actorId: user.id, action: "PRODUCT_DELETE", entity: "FacilityProduct", entityId: params.id, meta: { softDeleted: used > 0 } });
    return ok({ deleted: true, softDeleted: used > 0 });
  } catch (e) { return handleError(e); }
}
