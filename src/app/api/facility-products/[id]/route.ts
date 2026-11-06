import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
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
}).strip();

async function assertOwner(userId: string, fpId: string) {
  const fp = await prisma.facilityProduct.findUnique({ where: { id: fpId } });
  if (!fp) throw new Error("상품을 찾을 수 없습니다.");
  const owned = await ownedFacilityIds(userId);
  if (!owned.includes(fp.facilityId)) throw new Error("FORBIDDEN");
  return fp;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["FACILITY_ADMIN"]);
    await assertOwner(user.id, params.id);
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
    const updated = await prisma.facilityProduct.update({ where: { id: params.id }, data: parsed.data });
    await audit({ actorId: user.id, action: "PRODUCT_UPDATE", entity: "FacilityProduct", entityId: params.id });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["FACILITY_ADMIN"]);
    await assertOwner(user.id, params.id);
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
