import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";

// GET /api/facilities/[id]/products — 예약 시 고를 수 있는 이 공간의 판매 상품
// (예전에는 상품이 없으면 예시 상품을 돌려줬지만, 실제 예약에 연결되므로 실제 등록 상품만 돌려준다)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 셀러 공급가 · 셀러 수수료는 로그인한 셀러 · 스토리지마켓 · 관리자에게만 돌려준다 (비로그인 공개 화면에는 판매가 · 재고만)
    const viewer = await getSessionUser().catch(() => null);
    const trade = !!viewer && ["SELLER", "MANAGER", "SUPER_ADMIN"].includes(viewer.role);
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
      supplyPrice: trade ? fp.supplyPrice : null,
      stock: fp.stock,
      shippingInfo: fp.shippingInfo,
      commissionType: fp.commissionType,
      commissionValue: trade ? fp.commissionValue : 0,
      isSellable: fp.isSellable,
      bookedCount: trade ? fp._count.bookingProducts : 0,
      liveCount: trade ? fp._count.liveSessionProducts : 0,
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
