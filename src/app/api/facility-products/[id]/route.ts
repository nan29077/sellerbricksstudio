import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

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
    const body = await req.json();
    const updated = await prisma.facilityProduct.update({
      where: { id: params.id },
      data: {
        salePrice: body.salePrice, consumerPrice: body.consumerPrice, stock: body.stock,
        commissionType: body.commissionType, commissionValue: body.commissionValue,
        isSellable: body.isSellable, shippingInfo: body.shippingInfo,
      },
    });
    await audit({ actorId: user.id, action: "PRODUCT_UPDATE", entity: "FacilityProduct", entityId: params.id });
    return ok(updated);
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["FACILITY_ADMIN"]);
    await assertOwner(user.id, params.id);
    await prisma.facilityProduct.delete({ where: { id: params.id } });
    await audit({ actorId: user.id, action: "PRODUCT_DELETE", entity: "FacilityProduct", entityId: params.id });
    return ok({ deleted: true });
  } catch (e) { return handleError(e); }
}
