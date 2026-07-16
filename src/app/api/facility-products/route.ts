import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { facilityProductSchema } from "@/lib/validations";
import { ownedFacilityIds } from "@/lib/rbac";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN"]);
    const body = await req.json();
    const facilityId = body.facilityId as string;
    const data = facilityProductSchema.parse(body);

    const owned = await ownedFacilityIds(user.id);
    if (!owned.includes(facilityId)) return fail("본인 시설에만 상품을 등록할 수 있습니다.", 403);

    const product = await prisma.product.create({
      data: {
        name: data.name, sku: data.sku, category: data.category, description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        facilityProducts: {
          create: {
            facilityId, salePrice: data.salePrice, consumerPrice: data.consumerPrice, stock: data.stock,
            shippingInfo: data.shippingInfo, commissionType: data.commissionType,
            commissionValue: data.commissionValue, isSellable: data.isSellable, source: "CATALOG",
          },
        },
      },
      include: { facilityProducts: true },
    });
    await audit({ actorId: user.id, action: "PRODUCT_CREATE", entity: "FacilityProduct", entityId: product.facilityProducts[0]?.id });
    return ok(product, 201);
  } catch (e) { return handleError(e); }
}
