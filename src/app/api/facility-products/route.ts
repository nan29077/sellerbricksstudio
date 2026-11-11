import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { facilityProductSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    const body = await req.json();
    const { facilityId, ...data } = facilityProductSchema.extend({ facilityId: z.string().min(1).max(64) }).parse(body);

    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, ...(user.role !== "SUPER_ADMIN" && { ownerId: user.id }) },
      select: { id: true },
    });
    if (!facility) return fail("상품을 등록할 수 있는 창고(스튜디오)를 찾지 못했습니다.", 403);

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
