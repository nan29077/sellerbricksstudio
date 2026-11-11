import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/http";

// GET /api/facilities/[id]/products — 예약 시 고를 수 있는 이 창고(스튜디오)의 판매 상품
// (예전에는 상품이 없으면 예시 상품을 돌려줬지만, 실제 예약에 연결되므로 실제 등록 상품만 돌려준다)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fps = await prisma.facilityProduct.findMany({
      where: { facilityId: params.id, isSellable: true, facility: { status: "APPROVED" } },
      include: {
        product: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } } } },
        _count: { select: { bookingProducts: true, liveSessionProducts: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(fps.map((fp) => ({
      id: fp.id,
      salePrice: fp.salePrice,
      consumerPrice: fp.consumerPrice,
      supplyPrice: fp.supplyPrice,
      stock: fp.stock,
      shippingInfo: fp.shippingInfo,
      commissionType: fp.commissionType,
      commissionValue: fp.commissionValue,
      isSellable: fp.isSellable,
      bookedCount: fp._count.bookingProducts,
      liveCount: fp._count.liveSessionProducts,
      product: {
        id: fp.product.id,
        name: fp.product.name,
        category: fp.product.category,
        description: fp.product.description,
        thumbnailUrl: fp.product.thumbnailUrl ?? fp.product.images?.[0]?.url ?? null,
      },
    })));
  } catch (e) { return handleError(e); }
}
